// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/BatchTypesLib.sol";
import "./interfaces/ConstantsLib.sol";
import "./interfaces/TransactionTypesLib.sol";
import "./BridgingAddresses.sol";
import "./ChainTokens.sol";
import "./ClaimsHelper.sol";
import "./ClaimsProcessor.sol";
import "./Utils.sol";
import "./Validators.sol";
import "hardhat/console.sol";

/// @title Claims
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract Claims is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    address private adminContractAddress;

    /// @notice Mapping to track if a chain is registered.
    /// @dev BlockchainId -> bool
    mapping(uint8 => bool) public isChainRegistered;

    /// @notice Mapping from chain ID to next timeout block number.
    /// @dev BlochchainId -> blockNumber
    mapping(uint8 => uint256) public nextTimeoutBlock;

    /// @notice Maximum allowed transactions per batch.
    uint16 public maxNumberOfTransactions;

    /// @notice Number of blocks after which timeout is triggered.
    uint8 public timeoutBlocksNumber;

    /// @dev Deprecated: This mapping has been moved to the ChainTokens contract.
    ///      Use ChainTokens.chainTokenQuantity instead.
    mapping(uint8 => uint256) public __chainTokenQuantity;

    /// @dev Deprecated: This mapping has been moved to the ChainTokens contract.
    ///      Use ChainTokens.chainWrappedTokenQuantity instead.
    mapping(uint8 => uint256) public __chainWrappedTokenQuantity;

    /// @notice Mapping from chain ID and nonce to confirmed transaction.
    /// @dev BlockchainId -> nonce -> ConfirmedTransaction
    mapping(uint8 => mapping(uint64 => ConfirmedTransaction)) public confirmedTransactions;

    /// @notice Mapping from chain ID to nonce of the last confirmed transaction.
    /// @dev chainId -> nonce
    mapping(uint8 => uint64) public lastConfirmedTxNonce;

    /// @notice Mapping from chain ID to nonce of the last transaction from the executed batch.
    /// @dev chainId -> nonce
    mapping(uint8 => uint64) public lastBatchedTxNonce;

    /// @dev Deprecated: This mapping has been moved to the BridgingAddresses contract.
    ///      Use BridgingAddresses.isAddrDelegatedToStake instead.
    mapping(uint8 => mapping(uint8 => bool)) private __isAddrDelegatedToStake;

    BridgingAddresses private bridgingAddresses;
    ChainTokens private chainTokens;
    address private claimsProcessorAddress;
    address private registrationAddress;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters.
    /// @param _owner Address to be set as contract owner.
    /// @param _upgradeAdmin Address allowed to upgrade the contract.
    /// @param _maxNumberOfTransactions Max transactions per batch.
    /// @param _timeoutBlocksNumber Number of blocks until timeout.
    function initialize(
        address _owner,
        address _upgradeAdmin,
        uint16 _maxNumberOfTransactions,
        uint8 _timeoutBlocksNumber
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _bridgeAddress Address of the Bridge contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _validatorsAddress Address of the Validators contract.
    /// @param _adminContractAddress Address of the Admin contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress,
        address _adminContractAddress
    ) external onlyOwner {
        if (
            !_isContract(_adminContractAddress) ||
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        adminContractAddress = _adminContractAddress;
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Sets the external contracts dependencies and syncs it with the registered chains.
    /// @dev This function can only be called by the upgrade admin.
    ///      It verifies that the provided address is a contract before using it.
    /// @param _bridgingAddresses The address of the deployed BridgingAddresses contract.
    /// @param _chainTokens The address of the deployed ChainTokens contract to set and sync.
    /// @param _registrationAddress The address of the deployed Registration contract.
    /// @param _claimsProcessorAddress The address of the deployed ClaimsProcessor contract.
    /// @param isInitialDeployment Indicates whether this call occurs during the initial deployment of the contract. Set to false for upgrades.
    function setAdditionalDependenciesAndSync(
        address _bridgingAddresses,
        address _chainTokens,
        address _claimsProcessorAddress,
        address _registrationAddress,
        bool isInitialDeployment
    ) external onlyUpgradeAdmin {
        if (isInitialDeployment) {
            if (!_isContract(_bridgingAddresses)) revert NotContractAddress();
            bridgingAddresses = BridgingAddresses(_bridgingAddresses);
        }

        if (!_isContract(_chainTokens) || !_isContract(_claimsProcessorAddress) || !_isContract(_registrationAddress))
            revert NotContractAddress();
        chainTokens = ChainTokens(_chainTokens);
        claimsProcessorAddress = _claimsProcessorAddress;
        registrationAddress = _registrationAddress;

        Chain[] memory registeredChains = IBridge(bridgeAddress).getAllRegisteredChains();

        for (uint8 i; i < registeredChains.length; i++) {
            uint8 chainId = registeredChains[i].id;

            chainTokens.setInitialTokenQuantities(
                chainId,
                chainTokens.chainTokenQuantity(chainId),
                chainTokens.chainWrappedTokenQuantity(chainId)
            );

            uint64 nextNonce = lastBatchedTxNonce[chainId] + 1;
            uint64 lastConfirmedNonce = lastConfirmedTxNonce[chainId];

            // Rebuild receiversWithToken for non-executed confirmed transactions
            for (uint64 nonce = nextNonce; nonce <= lastConfirmedNonce; nonce++) {
                ConfirmedTransaction storage confirmedTx = confirmedTransactions[chainId][nonce];

                uint256 receiversLength = confirmedTx._receivers.length;
                for (uint256 j; j < receiversLength; j++) {
                    Receiver storage r = confirmedTx._receivers[j];

                    confirmedTx.receiversWithToken.push(
                        ReceiverWithToken(r.amount, r.amountWrapped, r.destinationAddress, 0)
                    );
                }
            }
        }
    }

    /// @notice Creates a stake type transaction for the BridgingAddresses contract.
    /// @dev Only callable by the BridgingAddresses contract.
    /// @param chainId The ID of the chain where the transaction is made.
    /// @param bridgeAddrIndex The index of the bridging address.
    /// @param stakePoolId The identifier of the stake pool (only used for delegation).
    /// @param transactionSubType The type of transaction (STAKE_REGISTRATION, STAKE_DELEGATION, or STAKE_DEREGISTRATION).
    function createStakeTransaction(
        uint8 chainId,
        uint8 bridgeAddrIndex,
        string calldata stakePoolId,
        uint8 transactionSubType
    ) external onlyBridgingAddresses {
        uint256 _confirmedTxCount = getBatchingTxsCount(chainId);

        ConfirmedTransaction storage confirmedTx = _createConfirmedTxCore(
            chainId,
            TransactionTypesLib.STAKE,
            bridgeAddrIndex,
            0,
            ConstantsLib.CHAIN_ID_AS_DESTINATION
        );
        confirmedTx.transactionSubType = transactionSubType;
        confirmedTx.stakePoolId = stakePoolId;

        _updateNextTimeoutBlockIfNeeded(chainId, _confirmedTxCount);
    }

    /// @notice Creates a redistribution transaction for bridging addresses on a specific chain.
    /// @dev Can only be called by the bridge contract. This transaction redistributes tokens across bridging addresses.
    /// @param chainId The ID of the source chain for which the redistribution transaction should be created.
    function createRedistributeTokensTx(uint8 chainId) external onlyAdminContract {
        uint256 _confirmedTxCount = getBatchingTxsCount(chainId);

        _createConfirmedTxCore(chainId, TransactionTypesLib.REDISTRIBUTION, 0, 0, ConstantsLib.CHAIN_ID_AS_DESTINATION);

        _updateNextTimeoutBlockIfNeeded(chainId, _confirmedTxCount);
    }

    /// @notice Sets the confirmed transaction details for a bridging request claim.
    /// @dev This function stores the details of a confirmed transaction for a specific bridging request claim,
    ///      including the transaction's amount, block height, source and destination chain IDs, and the list of receivers.
    ///      It also increments the nonce and sets the transaction type.
    /// @param _claim The bridging request claim containing details about the transaction, including the total amount,
    ///               source and destination chain IDs, observed transaction hash, retry counter, and receivers.
    /// @dev The function stores the confirmed transaction details in the `confirmedTransactions` mapping and increments
    ///      the nonce for the destination chain. It also sets the relevant properties for the transaction, including
    ///      its retry counter and list of receivers.
    function setConfirmedTransactions(BridgingRequestClaim memory _claim) external onlyClaimsProcessor {
        uint8 destinationChainId = _claim.destinationChainId;

        ConfirmedTransaction storage confirmedTx = _createConfirmedTxCore(
            destinationChainId,
            TransactionTypesLib.NORMAL,
            _claim.bridgeAddrIndex,
            _claim.retryCounter,
            ConstantsLib.CHAIN_ID_AS_DESTINATION
        );

        confirmedTx.totalAmount = _claim.nativeCurrencyAmountDestination;
        confirmedTx.totalWrappedAmount = _claim.wrappedTokenAmountDestination;
        confirmedTx.observedTransactionHash = _claim.observedTransactionHash;
        confirmedTx.sourceChainId = _claim.sourceChainId;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; i++) {
            confirmedTx.receiversWithToken.push(_claim.receivers[i]);
        }
    }

    /// @notice Sets the confirmed transaction details for a refund request claim.
    /// @dev This function stores the details of a confirmed transaction for a refund request claim, including the amount,
    ///      block height, transaction hash, source chain ID, and output indexes. It also sets the retry counter and
    ///      transaction type, and handles the logic for hot wallet decrements if applicable.
    /// @param _claim The refund request claim containing details about the refund transaction, including the amount,
    ///               sender address, transaction hash, output indexes, and whether the hot wallet should be decremented.
    /// @dev The function stores the confirmed refund transaction in the `confirmedTransactions` mapping, increments the
    ///      nonce for the specified chain, and sets the relevant properties for the transaction, including the retry counter,
    ///      transaction type, output indexes, and receivers.
    function setConfirmedTransactionsRRC(RefundRequestClaim memory _claim) external onlyClaimsProcessor {
        ConfirmedTransaction storage confirmedTx = _createConfirmedTxCore(
            _claim.originChainId,
            TransactionTypesLib.REFUND,
            _claim.bridgeAddrIndex,
            _claim.retryCounter,
            ConstantsLib.CHAIN_ID_AS_SOURCE
        );
        confirmedTx.totalAmount = _claim.originAmount;
        confirmedTx.totalWrappedAmount = _claim.originWrappedAmount;
        confirmedTx.observedTransactionHash = _claim.originTransactionHash;
        confirmedTx.destinationChainId = _claim.destinationChainId;
        confirmedTx.outputIndexes = _claim.outputIndexes;
        confirmedTx.alreadyTriedBatch = _claim.shouldDecrementHotWallet;

        uint256 colCoinsLength = _claim.tokenAmounts.length;
        for (uint i; i < colCoinsLength; i++) {
            confirmedTx.receiversWithToken.push(
                ReceiverWithToken(
                    _claim.tokenAmounts[i].amountCurrency,
                    _claim.tokenAmounts[i].amountTokens,
                    _claim.originSenderAddress,
                    _claim.tokenAmounts[i].tokenId
                )
            );
        }
    }

    /// @notice Determines whether a new batch should be created for a specific destination chain.
    /// @dev This function checks if the destination chain is registered and whether a batch has already been created for it.
    ///      It then evaluates if the number of transactions in the batch has reached the maximum limit or if the timeout block
    ///      has passed, signaling that a new batch can be created.
    /// @param _destinationChain The ID of the destination chain for which the batch creation is being checked.
    /// @return A boolean value indicating whether a new batch should be created (`true`) or not (`false`).
    /// @dev If the destination chain is not registered or if a batch has already been created, the function returns `false`.
    ///      Otherwise, it checks if the transaction count for the destination chain has reached the maximum allowed or if
    ///      the timeout block has been surpassed, in which case it returns `true`.
    function shouldCreateBatch(uint8 _destinationChain) public view returns (bool) {
        // if not registered chain or batch is already created, return false
        if (!isChainRegistered[_destinationChain] || claimsHelper.currentBatchBlock(_destinationChain) != int(-1)) {
            return false;
        }

        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    /// @notice Retrieves a confirmed transaction by chain ID and nonce.
    /// @param _destinationChain The ID of the destination chain where the transaction was confirmed.
    /// @param _nonce The nonce of the confirmed transaction to retrieve.
    /// @return _confirmedTransaction The `ConfirmedTransaction` struct containing transaction details.
    function getConfirmedTransaction(
        uint8 _destinationChain,
        uint64 _nonce
    ) public view returns (ConfirmedTransaction memory _confirmedTransaction) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    /// @notice Calculates the number of confirmed transactions ready for batching for a specific chain.
    /// @dev Iterates through confirmed transactions from the last batched nonce up to the batching limit or timeout,
    ///      and counts how many are eligible to be included in the next batch.
    /// @param _chainId The ID of the chain for which to count batching-eligible transactions.
    /// @return counterConfirmedTransactions The number of confirmed transactions ready to be batched.
    function getBatchingTxsCount(uint8 _chainId) public view returns (uint64 counterConfirmedTransactions) {
        uint64 lastConfirmedTxNonceForChain = lastConfirmedTxNonce[_chainId];
        uint64 lastBatchedTxNonceForChain = lastBatchedTxNonce[_chainId];
        uint256 timeoutBlock = nextTimeoutBlock[_chainId];
        uint64 maxTxsCount = maxNumberOfTransactions;

        uint64 txsToProcess = lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain >= maxTxsCount
            ? maxTxsCount
            : lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain;

        uint64 txIndx = lastBatchedTxNonceForChain + 1;

        while (counterConfirmedTransactions < txsToProcess) {
            if (confirmedTransactions[_chainId][txIndx].blockHeight >= timeoutBlock) {
                break;
            }
            ++counterConfirmedTransactions;
            ++txIndx;
        }
    }

    /// @notice Registers a new chain and initializes its token supply.
    /// @dev This function is restricted to be called only by the Bridge contract.
    ///      It marks the chain as registered, sets the initial token quantity,
    ///      initializes the timeout block, and resets the current batch block.
    /// @param _chainId The ID of the chain to register.
    /// @param _initialTokenSupply The initial amount of tokens available on the registered chain.
    function setChainRegistered(
        uint8 _chainId,
        uint256 _initialTokenSupply,
        uint256 _initialWrappedTokenSupply
    ) external onlyRegistration {
        isChainRegistered[_chainId] = true;
        chainTokens.setInitialTokenQuantities(_chainId, _initialTokenSupply, _initialWrappedTokenSupply);

        nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    /// @notice Initiates a defunding operation by creating a BridgingRequestClaim for a specific chain.
    /// @dev Updates internal state and sets a confirmed transaction.
    /// @param _chainId The ID of the chain from which to defund.
    /// @param _amount The amount of tokens to defund.
    /// @param _amountWrapped The amount of wrapped tokens to defund.
    /// @param _tokenAmounts An array of additional token amounts to include in the defund transaction.
    /// @param _defundAddress The address (as a string) to which the defunded tokens should be sent.
    /// @custom:reverts ChainIsNotRegistered if the chain is not registered.
    /// @custom:reverts DefundRequestTooHigh if the requested defund amount exceeds the available balance.
    function defund(
        uint8 _chainId,
        uint256 _amount,
        uint256 _amountWrapped,
        TokenAmount[] calldata _tokenAmounts,
        string calldata _defundAddress
    ) external onlyAdminContract {
        if (!isChainRegistered[_chainId]) {
            revert ChainIsNotRegistered(_chainId);
        }

        chainTokens.validateDefund(_chainId, _amount, _amountWrapped);

        uint256 _confirmedTxCount = getBatchingTxsCount(_chainId);

        ConfirmedTransaction storage confirmedTx = _createConfirmedTxCore(
            _chainId,
            TransactionTypesLib.DEFUND,
            0,
            0,
            ConstantsLib.CHAIN_ID_AS_BOTH
        );
        confirmedTx.totalAmount = _amount;
        confirmedTx.totalWrappedAmount = _amountWrapped;
        if (_amount > 0 || _amountWrapped > 0) {
            confirmedTx.receiversWithToken.push(ReceiverWithToken(_amount, _amountWrapped, _defundAddress, 0));
        }

        uint256 colCoinsLength = _tokenAmounts.length;
        for (uint i; i < colCoinsLength; i++) {
            confirmedTx.receiversWithToken.push(
                ReceiverWithToken(
                    _tokenAmounts[i].amountCurrency,
                    _tokenAmounts[i].amountTokens,
                    _defundAddress,
                    _tokenAmounts[i].tokenId
                )
            );
        }

        chainTokens.updateDefund(_chainId, _amount, _amountWrapped);

        _updateNextTimeoutBlockIfNeeded(_chainId, _confirmedTxCount);
    }

    /// @notice Updates the next timeout block for a given chain if certain conditions are met.
    /// @dev This function resets the timeout block only when there is no batch in progress,
    ///      no confirmed transactions, and the current block has reached or passed the timeout.
    /// @param _chainId The ID of the chain to update the timeout block for.
    /// @param _confirmedTxCount The number of confirmed transactions for the specified chain.
    function updateNextTimeoutBlockIfNeeded(uint8 _chainId, uint256 _confirmedTxCount) external onlyClaimsProcessor {
        _updateNextTimeoutBlockIfNeeded(_chainId, _confirmedTxCount);
    }

    /// @notice Updates the next timeout block for a given chain if certain conditions are met.
    /// @dev This function resets the timeout block only when there is no batch in progress,
    ///      no confirmed transactions, and the current block has reached or passed the timeout.
    /// @param _chainId The ID of the chain to update the timeout block for.
    /// @param _confirmedTxCount The number of confirmed transactions for the specified chain.
    function _updateNextTimeoutBlockIfNeeded(uint8 _chainId, uint256 _confirmedTxCount) internal {
        if (
            (claimsHelper.currentBatchBlock(_chainId) == -1) && // there is no batch in progress
            (_confirmedTxCount == 0) && // check if there is no other confirmed transactions
            (block.number >= nextTimeoutBlock[_chainId])
        ) {
            // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        }
    }

    /// @notice Retrieves a list of transactions for a specific batch on a given chain.
    /// @dev This function returns transaction details for a batch identified by its batch ID.
    ///      If the batch is a consolidation batch does not exist, an empty array
    ///      is returned.
    /// @param _chainId The ID of the chain on which the batch exists.
    /// @param _batchId The ID of the batch to retrieve transactions for.
    /// @return status A status code indicating the success or failure of the operation.
    /// @return txs An array of `TxDataInfo` structs, each containing the transaction hash, source chain ID,
    ///         and transaction type.
    function getBatchStatusAndTransactions(
        uint8 _chainId,
        uint64 _batchId
    ) external view returns (uint8 status, TxDataInfo[] memory txs) {
        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            _chainId,
            _batchId
        );

        uint8 _status = _confirmedSignedBatch.status;
        // if the batch is a consolidation or does not exist, return empty array
        if (_status == ConstantsLib.NOT_EXISTS || _confirmedSignedBatch.batchType == BatchTypesLib.CONSOLIDATION) {
            return (_status, new TxDataInfo[](0));
        }

        uint64 _firstTxNonce = _confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNonce = _confirmedSignedBatch.lastTxNonceId;

        TxDataInfo[] memory _txHashes = new TxDataInfo[](_lastTxNonce - _firstTxNonce + 1);
        for (uint64 i = _firstTxNonce; i <= _lastTxNonce; i++) {
            ConfirmedTransaction storage ctx = confirmedTransactions[_chainId][i];
            _txHashes[i - _firstTxNonce] = TxDataInfo(
                ctx.observedTransactionHash,
                ctx.sourceChainId,
                ctx.transactionType
            );
        }

        return (_status, _txHashes);
    }

    function updateMaxNumberOfTransactions(uint16 _maxNumberOfTransactions) external onlyAdminContract {
        maxNumberOfTransactions = _maxNumberOfTransactions;
    }

    function updateTimeoutBlocksNumber(uint8 _timeoutBlocksNumber) external onlyAdminContract {
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    /// @notice Get confirmed transactions ready for batching for a specific destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _confirmedTransactions Array of confirmed transactions.
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint64 firstTxNonce = lastBatchedTxNonce[_destinationChain] + 1;

        uint64 counterConfirmedTransactions = getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint64 i; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    /// @notice Initializes and stores the core fields of a new confirmed transaction
    /// @dev Increments nonce for the given chain and creates a new ConfirmedTransaction in storage
    /// @param chainId ID of the chain for which this transaction is being confirmed
    /// @param transactionType Encoded transaction type (see TransactionTypesLib)
    /// @param bridgeAddrIndex Index of the bridge address used during this transaction
    /// @param retryCounter Number of retry attempts made prior to this confirmation
    /// @param chainIdRoleFlag Bitmask role indicator (source or destination chain)
    /// @return confirmedTx Storage pointer to the newly created ConfirmedTransaction
    function _createConfirmedTxCore(
        uint8 chainId,
        uint8 transactionType,
        uint8 bridgeAddrIndex,
        uint256 retryCounter,
        uint8 chainIdRoleFlag
    ) internal returns (ConfirmedTransaction storage confirmedTx) {
        uint64 nextNonce = ++lastConfirmedTxNonce[chainId];

        confirmedTx = confirmedTransactions[chainId][nextNonce];
        confirmedTx.transactionType = transactionType;
        confirmedTx.nonce = nextNonce;
        confirmedTx.bridgeAddrIndex = bridgeAddrIndex;
        confirmedTx.blockHeight = block.number;
        confirmedTx.retryCounter = retryCounter;

        if ((chainIdRoleFlag & ConstantsLib.CHAIN_ID_AS_DESTINATION) != 0) {
            confirmedTx.destinationChainId = chainId;
        }

        if ((chainIdRoleFlag & ConstantsLib.CHAIN_ID_AS_SOURCE) != 0) {
            confirmedTx.sourceChainId = chainId;
        }
    }

    /// @notice Retries a previously confirmed transaction by assigning it a new nonce.
    /// @dev Increments the chain's last confirmed transaction nonce and stores the retried transaction with an updated retry counter.
    /// @param chainId The ID of the chain for which the transaction is being retried.
    /// @param _ctx The confirmed transaction to retry.
    function retryTx(uint8 chainId, ConfirmedTransaction memory _ctx) external onlyClaimsProcessor {
        uint64 nextNonce = ++lastConfirmedTxNonce[chainId];
        confirmedTransactions[chainId][nextNonce] = _ctx;
        confirmedTransactions[chainId][nextNonce].nonce = nextNonce;
        confirmedTransactions[chainId][nextNonce].retryCounter++;
    }

    function setLastBatchedTxNonce(uint8 _chainId, uint64 _lastBatchedTxNonce) external onlyClaimsProcessor {
        lastBatchedTxNonce[_chainId] = _lastBatchedTxNonce;
    }

    function setNextTimeoutBlock(uint8 _chainId, uint256 _nextTimeoutBlock) external onlyClaimsProcessor {
        nextTimeoutBlock[_chainId] = _nextTimeoutBlock;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.3.0";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyAdminContract() {
        if (msg.sender != adminContractAddress) revert NotAdminContract();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }

    modifier onlyRegistration() {
        if (msg.sender != registrationAddress) revert NotRegistration();
        _;
    }

    modifier onlyBridgingAddresses() {
        if (msg.sender != address(bridgingAddresses)) revert NotBridgingAddresses();
        _;
    }

    modifier onlyClaimsProcessor() {
        if (msg.sender != claimsProcessorAddress) revert NotClaimsProcessor();
        _;
    }
}
