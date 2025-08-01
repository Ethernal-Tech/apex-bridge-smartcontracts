// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/ConstantsLib.sol";
import "./Utils.sol";
import "./Bridge.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

/// @title Claims
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract Claims is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using ConstantsLib for uint8;

    address private upgradeAdmin;
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    address private adminContractAddress;

    /// @notice Hash for the "Defund" packed claim type.
    bytes32 public constant defundHash = 0xc74d0d70be942fd68984df57687b9f453f1321726e8db77762dee952a5c85b24;

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

    /// @notice Mapping from chain ID to token quantity.
    /// @dev BlockchainId -> TokenQuantity
    mapping(uint8 => uint256) public chainTokenQuantity;

    /// @notice Mapping from chain ID and nonce to confirmed transaction.
    /// @dev BlockchainId -> nonce -> ConfirmedTransaction
    mapping(uint8 => mapping(uint64 => ConfirmedTransaction)) public confirmedTransactions;

    /// @notice Mapping from chain ID to nonce of the last confirmed transaction.
    /// @dev chainId -> nonce
    mapping(uint8 => uint64) public lastConfirmedTxNonce;

    /// @notice Mapping from chain ID to nonce of the last transaction from the executed batch.
    /// @dev chainId -> nonce
    mapping(uint8 => uint64) public lastBatchedTxNonce;

    /// @notice Maximum number of retries allowed for defund claims.
    uint8 private constant MAX_NUMBER_OF_DEFUND_RETRIES = 3;
    /// @notice Maximum number of claims allowed per submission.
    uint8 private constant MAX_NUMBER_OF_CLAIMS = 32;
    /// @notice Maximum number of receivers in a BridgingRequestClaim.
    uint8 private constant MAX_NUMBER_OF_RECEIVERS = 16;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

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
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_validatorsAddress) ||
            !_isContract(_adminContractAddress)
        ) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
        adminContractAddress = _adminContractAddress;
    }

    /// @notice Submit claims from validators for reaching consensus.
    /// @param _claims Struct containing all types of validator claims.
    /// @param _caller Address of the validator submitting the claims.
    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        uint256 hotWalletIncrementClaimsLength = _claims.hotWalletIncrementClaims.length;

        uint256 claimsLength = bridgingRequestClaimsLength +
            batchExecutedClaimsLength +
            batchExecutionFailedClaimsLength +
            refundRequestClaimsLength +
            hotWalletIncrementClaimsLength;

        if (claimsLength > MAX_NUMBER_OF_CLAIMS) {
            revert TooManyClaims(claimsLength, MAX_NUMBER_OF_CLAIMS);
        }

        for (uint i; i < bridgingRequestClaimsLength; i++) {
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            uint8 sourceChainId = _claim.sourceChainId;
            uint8 destinationChainId = _claim.destinationChainId;

            if (!isChainRegistered[sourceChainId]) {
                revert ChainIsNotRegistered(sourceChainId);
            }

            if (!isChainRegistered[destinationChainId]) {
                revert ChainIsNotRegistered(destinationChainId);
            }

            if (_claim.receivers.length > MAX_NUMBER_OF_RECEIVERS) {
                revert TooManyReceivers(_claim.receivers.length, MAX_NUMBER_OF_RECEIVERS);
            }

            _submitClaimsBRC(_claim, i, _caller);
        }

        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEC(_claim, _caller);
        }

        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEFC(_claim, _caller);
        }

        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.originChainId]) {
                revert ChainIsNotRegistered(_claim.originChainId);
            }

            _submitClaimsRRC(_claim, _caller);
        }
        for (uint i; i < hotWalletIncrementClaimsLength; i++) {
            HotWalletIncrementClaim calldata _claim = _claims.hotWalletIncrementClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimHWIC(_claim, _caller);
        }
    }

    /// @notice Submits a Bridging Request Claim (BRC) for processing.
    /// @dev This function checks if there are enough funds available on the destination chain, validates the claim,
    ///      and updates the state of the contract by confirming the transaction and adjusting token quantities.
    /// @param _claim The bridging request claim containing the details of the transaction.
    /// @param i The index of the claim in the array of bridging request claims.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If there are not enough funds on the destination chain, the function emits a `NotEnoughFunds` event and exits early.
    /// @dev The function requires a quorum of validators to approve the claim before proceeding with the transaction.
    /// @dev After quorum is reached, the destination chain's token quantity is reduced, and the source chain's token quantity is increased if it's the first retry.
    /// @dev The function also updates the next timeout block if necessary and sets the confirmed transaction details.
    function _submitClaimsBRC(BridgingRequestClaim calldata _claim, uint256 i, address _caller) internal {
        uint256 _receiversSumSrc = _claim.totalAmountSrc;
        uint256 _receiversSumDst = _claim.totalAmountDst;
        uint8 _destinationChainId = _claim.destinationChainId;
        uint256 _chainTokenQuantityDestination = chainTokenQuantity[_destinationChainId];

        bytes32 _claimHash = keccak256(abi.encode("BRC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.getVotesCount(_claimHash);
        // if quorum already reached -> exit
        if (_votesCount == _quorumCount) {
            return; 
        }
        // check token quantity on destination
        if (_chainTokenQuantityDestination < _receiversSumDst) {
            emit NotEnoughFunds("BRC", i, _chainTokenQuantityDestination);
            // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
            return;
        }
        // update votes count with current validator 
        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            chainTokenQuantity[_destinationChainId] -= _receiversSumDst;

            // if it is the first occurance of Bridging Request Claim, add the amount to the source chain
            // otherwise, it is a retry and we do not add the amount to the source chain, since it has already been done
            if (_claim.retryCounter == 0) {
                chainTokenQuantity[_claim.sourceChainId] += _receiversSumSrc;
            }

            uint256 _confirmedTxCount = getBatchingTxsCount(_destinationChainId);

            _setConfirmedTransactions(_claim, 0);

            _updateNextTimeoutBlockIfNeeded(_destinationChainId, _confirmedTxCount);
        }
    }

    /// @notice Submits a Batch Executed Claim (BEC) for processing.
    /// @dev This function checks if a batch has already been processed, validates the claim, and updates the state
    ///      by resetting the current batch block, updating the last transaction nonce, and managing timeout blocks.
    /// @param _claim The batch executed claim containing the details of the batch execution.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If the batch has already been processed (first and last transaction nonces are zero), the function exits early
    ///      to prevent double-processing of the same batch.
    /// @dev A quorum of validators is required to approve the claim before proceeding.
    /// @dev If the batch is not a consolidation, the batch’s last transaction nonce is updated, and the next timeout block
    ///      is set based on the current block number.
    /// @dev The claim's corresponding signed batch data is deleted once the claim is processed.
    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        bytes32 claimHash = keccak256(abi.encode("BEC", _claim));

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
            _validatorIdx,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);
            claimsHelper.setConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.EXECUTED);

            // do not process included transactions if it is a consolidation
            if (_confirmedSignedBatch.isConsolidation) {
                return;
            }

            lastBatchedTxNonce[chainId] = _confirmedSignedBatch.lastTxNonceId;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        bytes32 claimHash = keccak256(abi.encode("BEFC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
            _validatorIdx,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);
            claimsHelper.setConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.FAILED);

            // do not process included transactions if it is a consolidation
            if (_confirmedSignedBatch.isConsolidation) {
                return;
            }

            uint64 _firstTxNonce = _confirmedSignedBatch.firstTxNonceId;
            uint64 _lastTxNonce = _confirmedSignedBatch.lastTxNonceId;

            uint256 _currentAmount = chainTokenQuantity[chainId];

            // Iterates through all transactions in the batch
            // and retries them by creating new transactions
            // or in face maximal number of retries has been reached
            // emits an event and makes changes to the hot wallet balance
            for (uint64 i = _firstTxNonce; i <= _lastTxNonce; i++) {
                ConfirmedTransaction storage _ctx = confirmedTransactions[chainId][i];
                uint8 _txType = _ctx.transactionType;
                if (_txType == 0) {
                    _currentAmount += _ctx.totalAmount;
                } else if (_txType == 1) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_DEFUND_RETRIES) {
                        uint64 nextNonce = ++lastConfirmedTxNonce[chainId];
                        confirmedTransactions[chainId][nextNonce] = _ctx;
                        confirmedTransactions[chainId][nextNonce].nonce = nextNonce;
                        confirmedTransactions[chainId][nextNonce].retryCounter++;
                    } else {
                        _currentAmount += _ctx.totalAmount;
                        emit DefundFailedAfterMultipleRetries();
                    }
                }
            }

            chainTokenQuantity[chainId] = _currentAmount;
            lastBatchedTxNonce[chainId] = _lastTxNonce;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    /// @notice Submits a Batch Execution Failed Claim (BEFC) for processing.
    /// @dev This function checks if a batch has been processed, validates the claim, and handles the failed batch execution
    ///      by updating the state, retrying failed transactions if applicable, and resetting the current batch block.
    /// @param _claim The batch execution failed claim containing the details of the failed batch execution.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If the batch has already been processed (first and last transaction nonces are zero), the function exits early
    ///      to prevent double-processing of the same batch.
    /// @dev A quorum of validators is required to approve the claim before proceeding.
    /// @dev The batch's failed transactions are handled by retrying the transactions up to a maximum retry count,
    ///      or marking them as failed if retries exceed the limit.
    /// @dev The batch's token quantity is updated, and the corresponding batch data is deleted once the claim is processed.
    function _submitClaimsRRC(RefundRequestClaim calldata _claim, address _caller) internal {
        // temporary check until automatic refund is implemented
        // once automatic refund is implemented, this check should be that
        // either originTransactionHash or refundTransactionHash should be empty
        if (_claim.refundTransactionHash != bytes32(0)) {
            revert InvalidData("refundTransactionHash");
        }

        uint8 originChainId = _claim.originChainId;

        bytes32 _claimHash = keccak256(abi.encode("RRC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.getVotesCount(_claimHash);
        // if quorum already reached -> exit
        if (_votesCount == _quorumCount) {
            return; 
        }
        // check token quantity on source if needed
        if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0) {
            uint256 _chainTokenQuantityOrigin = chainTokenQuantity[originChainId];
            if (_chainTokenQuantityOrigin < _claim.originAmount) {
                emit NotEnoughFunds("RRC", 0, _chainTokenQuantityOrigin);
                // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit
                return;
            }
        }
        // update votes count with current validator 
        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            uint256 _confirmedTxCount = getBatchingTxsCount(originChainId);

            if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0) {
                // refund after failing on destination chain, return originAmount to hot wallet
                chainTokenQuantity[originChainId] -= _claim.originAmount;
            }

            _setConfirmedTransactionsRRC(_claim);

            _updateNextTimeoutBlockIfNeeded(originChainId, _confirmedTxCount);
        }
    }

    /// @notice Submits a Hot Wallet Increment Claim (HWIC) for processing.
    /// @dev This function processes a claim that increases the hot wallet balance of a specific chain.
    ///      It checks if the quorum of validators has been reached before applying the change to the hot wallet.
    /// @param _claim The hot wallet increment claim containing the chain ID and the amount to be added to the hot wallet.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev The claim is validated by ensuring that a quorum of validators has approved it before proceeding.
    /// @dev If the quorum is reached, the specified amount is added to the hot wallet balance for the given chain.
    function _submitClaimHWIC(HotWalletIncrementClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("HWIC", _claim));

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
            _validatorIdx,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            chainTokenQuantity[_claim.chainId] += _claim.amount;
        }
    }

    /// @notice Sets the confirmed transaction details for a bridging request claim.
    /// @dev This function stores the details of a confirmed transaction for a specific bridging request claim,
    ///      including the transaction's amount, block height, source and destination chain IDs, and the list of receivers.
    ///      It also increments the nonce and sets the transaction type.
    /// @param _claim The bridging request claim containing details about the transaction, including the total amount,
    ///               source and destination chain IDs, observed transaction hash, retry counter, and receivers.
    /// @param _transactionType The type of the transaction (e.g., bridging request, refund, etc.) that is being processed.
    /// @dev The function stores the confirmed transaction details in the `confirmedTransactions` mapping and increments
    ///      the nonce for the destination chain. It also sets the relevant properties for the transaction, including
    ///      its retry counter and list of receivers.
    function _setConfirmedTransactions(BridgingRequestClaim memory _claim, uint8 _transactionType) internal {
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];

        ConfirmedTransaction storage confirmedTx = confirmedTransactions[destinationChainId][nextNonce];
        confirmedTx.totalAmount = _claim.totalAmountDst;
        confirmedTx.blockHeight = block.number;
        confirmedTx.observedTransactionHash = _claim.observedTransactionHash;
        confirmedTx.sourceChainId = _claim.sourceChainId;
        confirmedTx.nonce = nextNonce;
        confirmedTx.retryCounter = _claim.retryCounter;
        confirmedTx.transactionType = _transactionType;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; i++) {
            confirmedTx.receivers.push(_claim.receivers[i]);
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
    function _setConfirmedTransactionsRRC(RefundRequestClaim memory _claim) internal {
        uint8 chainId = _claim.originChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[chainId];

        ConfirmedTransaction storage confirmedTx = confirmedTransactions[chainId][nextNonce];
        confirmedTx.totalAmount = _claim.originAmount;
        confirmedTx.blockHeight = block.number;
        confirmedTx.observedTransactionHash = _claim.originTransactionHash;
        confirmedTx.sourceChainId = chainId;
        confirmedTx.nonce = nextNonce;
        confirmedTx.retryCounter = _claim.retryCounter;
        confirmedTx.transactionType = 2;
        confirmedTx.outputIndexes = _claim.outputIndexes;
        confirmedTx.alreadyTriedBatch = _claim.shouldDecrementHotWallet;

        confirmedTx.receivers.push(Receiver(_claim.originAmount, _claim.originSenderAddress));
    }

    /// @notice Registers a vote for a specific claim hash only if the voter hasn't already voted and quorum hasn't been reached.
    /// @dev Increments the vote count if conditions are met and returns whether the quorum is now reached.
    /// @param _validatorIdx The index of validator in the validator set.
    /// @param _hash The unique hash representing the claim being voted on.
    /// @param _quorumCnt The number of votes required to reach quorum.
    /// @return True if quorum has been reached after this vote; false otherwise.
    function setVotedOnlyIfNeededReturnQuorumReached(
        uint8 _validatorIdx,
        bytes32 _hash,
        uint256 _quorumCnt
    ) external onlyBridge returns (bool) {
        return claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(_validatorIdx, _hash, _quorumCnt);
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

    /// @notice Resets the current batch block for a given chain.
    /// @param _chainId The ID of the chain for which to reset the current batch block.
    function resetCurrentBatchBlock(uint8 _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    /// @notice Registers a new chain and initializes its token supply.
    /// @dev This function is restricted to be called only by the Bridge contract.
    ///      It marks the chain as registered, sets the initial token quantity,
    ///      initializes the timeout block, and resets the current batch block.
    /// @param _chainId The ID of the chain to register.
    /// @param _initialTokenSupply The initial amount of tokens available on the registered chain.
    function setChainRegistered(uint8 _chainId, uint256 _initialTokenSupply) external onlyBridge {
        isChainRegistered[_chainId] = true;
        chainTokenQuantity[_chainId] = _initialTokenSupply;
        nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    /// @notice Updates the timeout block for a specific chain.
    /// @dev Only callable by the Bridge contract. Sets the next timeout block to the provided block number plus the predefined timeout period.
    /// @param _chainId The ID of the chain for which the timeout block is being set.
    /// @param _blockNumber The reference block number used to calculate the next timeout block.
    function setNextTimeoutBlock(uint8 _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    /// @notice Checks whether a specific voter has already voted for a given claim hash.
    /// @param _hash The hash of the claim being voted on.
    /// @param _voter The address of the voter to check.
    /// @return True if the voter has voted for the given claim hash, false otherwise.
    function hasVoted(bytes32 _hash, address _voter) external view returns (bool) {
        uint8 _validatorIdx = validators.getValidatorIndex(_voter) - 1;
        return claimsHelper.hasVoted(_hash, _validatorIdx);
    }

    /// @notice Initiates a defunding operation by creating a BridgingRequestClaim for a specific chain.
    /// @dev Updates internal state and sets a confirmed transaction.
    /// @param _chainId The ID of the chain from which to defund.
    /// @param _amount The amount of tokens to defund.
    /// @param _defundAddress The address (as a string) to which the defunded tokens should be sent.
    /// @custom:reverts ChainIsNotRegistered if the chain is not registered.
    /// @custom:reverts DefundRequestTooHigh if the requested defund amount exceeds the available balance.
    function defund(uint8 _chainId, uint256 _amount, string calldata _defundAddress) external onlyAdminContract {
        if (!isChainRegistered[_chainId]) {
            revert ChainIsNotRegistered(_chainId);
        }

        uint256 _currentAmount = chainTokenQuantity[_chainId];

        if (_currentAmount < _amount) {
            revert DefundRequestTooHigh(_chainId, _currentAmount, _amount);
        }

        BridgingRequestClaim memory _brc = BridgingRequestClaim({
            observedTransactionHash: defundHash,
            receivers: new Receiver[](1),
            totalAmountSrc: _amount,
            totalAmountDst: _amount,
            retryCounter: 0,
            sourceChainId: _chainId,
            destinationChainId: _chainId
        });

        _brc.receivers[0].amount = _amount;
        _brc.receivers[0].destinationAddress = _defundAddress;

        chainTokenQuantity[_chainId] = _currentAmount - _amount;

        uint256 _confirmedTxCount = getBatchingTxsCount(_chainId);

        _setConfirmedTransactions(_brc, 1);

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
        ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
        {
            nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        }
    }

    /// @notice Updates the token quantity for a registered chain by increasing or decreasing the amount.
    /// @dev Reverts if the chain is not registered or if subtraction causes underflow.
    /// @param _chainId The ID of the chain whose token quantity is to be updated.
    /// @param _isIncrease A boolean indicating whether to increase (true) or decrease (false) the token amount.
    /// @param _tokenAmount The amount of tokens to add or subtract from the chain's total.
    function updateChainTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _tokenAmount
    ) external onlyAdminContract {
        if (!isChainRegistered[_chainId]) {
            revert ChainIsNotRegistered(_chainId);
        }

        uint256 _currentAmount = chainTokenQuantity[_chainId];

        if (_isIncrease) {
            chainTokenQuantity[_chainId] = _currentAmount + _tokenAmount;
        } else {
            if (_currentAmount < _tokenAmount) {
                revert NegativeChainTokenAmount(_currentAmount, _tokenAmount);
            }

            chainTokenQuantity[_chainId] = _currentAmount - _tokenAmount;
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

        uint64 _firstTxNonce = _confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNonce = _confirmedSignedBatch.lastTxNonceId;
        uint8 _status = _confirmedSignedBatch.status;
        // if the batch is a consolidation or does not exist, return empty array
        if (_status == ConstantsLib.NOT_EXISTS || _confirmedSignedBatch.isConsolidation) {
            return (_status, new TxDataInfo[](0));
        }

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

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.1";
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
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
