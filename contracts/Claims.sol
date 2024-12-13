// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Bridge.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract Claims is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;
    address private adminContractAddress;

    //keccak256)abi.encode(Packed"Defund")
    bytes32 public constant defundHash = 0xc74d0d70be942fd68984df57687b9f453f1321726e8db77762dee952a5c85b24;

    // BlockchainId -> bool
    mapping(uint8 => bool) public isChainRegistered;

    // BlochchainId -> blockNumber
    mapping(uint8 => uint256) public nextTimeoutBlock;

    uint16 public maxNumberOfTransactions;
    uint8 public timeoutBlocksNumber;

    // BlockchainId -> TokenQuantity
    mapping(uint8 => uint256) public chainTokenQuantity;

    // BlockchainId -> WrappedTokenQuantity
    mapping(uint8 => uint256) public chainWrappedTokenQuantity;

    // BlockchainId -> nonce -> ConfirmedTransaction
    mapping(uint8 => mapping(uint64 => ConfirmedTransaction)) public confirmedTransactions;

    // chainId -> nonce (nonce of the last confirmed transaction)
    mapping(uint8 => uint64) public lastConfirmedTxNonce;

    // chainId -> nonce (nonce of the last transaction from the executed batch)
    mapping(uint8 => uint64) public lastBatchedTxNonce;

    uint8 public constant MAX_NUMBER_OF_DEFUND_RETRIES = 3; //TO DO SET EXACT NUMBER TO BE USED

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _upgradeAdmin,
        uint16 _maxNumberOfTransactions,
        uint8 _timeoutBlocksNumber
    ) public initializer {
        _transferOwnership(_owner);
        upgradeAdmin = _upgradeAdmin;
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress,
        address _adminContractAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
        adminContractAddress = _adminContractAddress;
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
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

            _submitClaimsBRC(_claim, i, _caller);
        }

        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEC(_claim, _caller);
        }

        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEFC(_claim, _caller);
        }

        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsRRC(_claim, _caller);
        }

        uint256 refundExecutedClaimsLength = _claims.refundExecutedClaims.length;
        for (uint i; i < refundExecutedClaimsLength; i++) {
            RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsREC(_claim, _caller);
        }

        uint256 hotWalletIncrementClaimsLength = _claims.hotWalletIncrementClaims.length;
        for (uint i; i < hotWalletIncrementClaimsLength; i++) {
            HotWalletIncrementClaim calldata _claim = _claims.hotWalletIncrementClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimHWIC(_claim, _caller);
        }
    }

    function _submitClaimsBRC(BridgingRequestClaim calldata _claim, uint256 i, address _caller) internal {
        uint256 _quorumCnt = validators.getQuorumNumberOfValidators();
        bytes32 _claimHash = keccak256(abi.encode("BRC", _claim));
        if (claimsHelper.isVoteRestricted(_caller, _claimHash, _quorumCnt)) {
            return;
        }

        uint256 _nativeCurrencyAmountDestination = _claim.nativeCurrencyAmountDestination;
        uint256 _wrappedTokenAmountDestination = _claim.wrappedTokenAmountDestination;
        uint8 _destinationChainId = _claim.destinationChainId;

        if (chainTokenQuantity[_destinationChainId] < _nativeCurrencyAmountDestination) {
            emit NotEnoughFunds("BRC", i, chainTokenQuantity[_destinationChainId]);
            return;
        }

        if (chainWrappedTokenQuantity[_destinationChainId] < _wrappedTokenAmountDestination) {
            emit NotEnoughFunds("BRC", i, chainWrappedTokenQuantity[_destinationChainId]);
            return;
        }

        uint256 _votesCnt = claimsHelper.setVoted(_caller, _claimHash);

        if (_votesCnt == _quorumCnt) {
            chainTokenQuantity[_destinationChainId] -= _nativeCurrencyAmountDestination;
            chainWrappedTokenQuantity[_destinationChainId] -= _wrappedTokenAmountDestination;

            if (_claim.retryCounter == 0) {
                chainTokenQuantity[_claim.sourceChainId] += _claim.nativeCurrencyAmountSource;
                chainWrappedTokenQuantity[_claim.sourceChainId] += _claim.wrappedTokenAmountSource;
            }

            uint256 _confirmedTxCount = getBatchingTxsCount(_destinationChainId);

            _setConfirmedTransactions(_claim, 0);

            _updateNextTimeoutBlockIfNeeded(_destinationChainId, _confirmedTxCount);
        }
    }

    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        // The BatchExecutionInfo event should be emitted even if the validator has already voted
        // or if consensus has already been reached. Same goes for BEFC
        bytes32 claimHash = keccak256(abi.encode("BEC", _claim));
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainId,
                batchId
            );
            claimsHelper.resetCurrentBatchBlock(chainId);

            lastBatchedTxNonce[chainId] = _confirmedSignedBatch.lastTxNonceId;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("BEFC", _claim));
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            claimsHelper.resetCurrentBatchBlock(chainId);

            ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainId,
                batchId
            );

            uint64 _firstTxNonce = _confirmedSignedBatch.firstTxNonceId;
            uint64 _lastTxNouce = _confirmedSignedBatch.lastTxNonceId;

            for (uint64 i = _firstTxNonce; i <= _lastTxNouce; i++) {
                ConfirmedTransaction storage _ctx = confirmedTransactions[chainId][i];
                uint8 _txType = _ctx.transactionType;
                if (_txType == 0) {
                    chainTokenQuantity[chainId] += _ctx.totalAmount;
                } else if (_txType == 1) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_DEFUND_RETRIES) {
                        uint64 nextNonce = ++lastConfirmedTxNonce[chainId];
                        confirmedTransactions[chainId][nextNonce] = _ctx;
                        confirmedTransactions[chainId][nextNonce].nonce = nextNonce;
                        confirmedTransactions[chainId][nextNonce].retryCounter++;
                    } else {
                        chainTokenQuantity[chainId] += _ctx.totalAmount;
                        emit DefundFailedAfterMultipleRetries();
                    }
                } else {
                    //REFUND TO DO
                }
            }

            lastBatchedTxNonce[chainId] = _lastTxNouce;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(RefundRequestClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("RRC", _claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _submitClaimsREC(RefundExecutedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("REC", _claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _submitClaimHWIC(HotWalletIncrementClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("HWIC", _claim));

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            uint8 chainId = _claim.chainId;
            uint256 changeAmount = _claim.amount;
            uint256 changeWrappedAmount = _claim.amountWrapped;
            if (_claim.isIncrement) {
                chainTokenQuantity[chainId] += changeAmount;
                chainWrappedTokenQuantity[chainId] += changeWrappedAmount;
            } else if (chainTokenQuantity[chainId] >= changeAmount) {
                chainTokenQuantity[chainId] -= changeAmount;
                chainWrappedTokenQuantity[chainId] -= changeWrappedAmount;
            } else {
                emit InsufficientFunds(chainId, changeAmount);
            }
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim, uint8 _transactionType) internal {
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];

        ConfirmedTransaction storage confirmedTx = confirmedTransactions[destinationChainId][nextNonce];
        uint256 totalAmount;
        confirmedTx.blockHeight = block.number;
        confirmedTx.observedTransactionHash = _claim.observedTransactionHash;
        confirmedTx.sourceChainId = _claim.sourceChainId;
        confirmedTx.nonce = nextNonce;
        confirmedTx.retryCounter = _claim.retryCounter;
        confirmedTx.transactionType = _transactionType;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; i++) {
            confirmedTx.receivers.push(_claim.receivers[i]);
            totalAmount += _claim.receivers[i].amount;
        }

        confirmedTx.totalAmount = totalAmount;
    }

    function setVoted(address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_voter, _hash);
    }

    function shouldCreateBatch(uint8 _destinationChain) public view returns (bool) {
        // if not registered chain or batch is already created, return false
        if (!isChainRegistered[_destinationChain] || claimsHelper.currentBatchBlock(_destinationChain) != int(-1)) {
            return false;
        }

        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function getConfirmedTransaction(
        uint8 _destinationChain,
        uint64 _nonce
    ) public view returns (ConfirmedTransaction memory _confirmedTransaction) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

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
            counterConfirmedTransactions++;
            txIndx++;
        }
    }

    function resetCurrentBatchBlock(uint8 _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function setChainRegistered(
        uint8 _chainId,
        uint256 _initialTokenSupply,
        uint256 _initialWrappedTokenSupply
    ) external onlyBridge {
        isChainRegistered[_chainId] = true;
        chainTokenQuantity[_chainId] = _initialTokenSupply;
        chainWrappedTokenQuantity[_chainId] = _initialWrappedTokenSupply;
        nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function setNextTimeoutBlock(uint8 _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    function hasVoted(bytes32 _hash, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_hash, _voter);
    }

    function defund(uint8 _chainId, uint256 _amount, string calldata _defundAddress) external onlyAdminContract {
        BridgingRequestClaim memory _brc = BridgingRequestClaim({
            observedTransactionHash: defundHash,
            receivers: new Receiver[](1),
            nativeCurrencyAmountSource: _amount,
            wrappedTokenAmountSource: 0,
            nativeCurrencyAmountDestination: 0,
            wrappedTokenAmountDestination: 0,
            retryCounter: 0,
            sourceChainId: _chainId,
            destinationChainId: _chainId
        });

        _brc.receivers[0].amount = _amount;
        _brc.receivers[0].destinationAddress = _defundAddress;

        chainTokenQuantity[_chainId] -= _amount;

        uint256 _confirmedTxCount = getBatchingTxsCount(_chainId);

        _setConfirmedTransactions(_brc, 1);

        _updateNextTimeoutBlockIfNeeded(_chainId, _confirmedTxCount);
    }

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

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return chainTokenQuantity[_chainId];
    }

    function updateChainTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainTokenAmount,
        uint256 _chainWrappedTokenAmount
    ) external onlyAdminContract {
        chainTokenQuantity[_chainId] = _isIncrease
            ? chainTokenQuantity[_chainId] + _chainTokenAmount
            : chainTokenQuantity[_chainId] - _chainTokenAmount;

        chainWrappedTokenQuantity[_chainId] = _isIncrease
            ? chainWrappedTokenQuantity[_chainId] + _chainWrappedTokenAmount
            : chainWrappedTokenQuantity[_chainId] - _chainWrappedTokenAmount;
    }

    function getBatchTransactions(uint8 _chainId, uint64 _batchId) external view returns (TxDataInfo[] memory) {
        ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            _chainId,
            _batchId
        );
        uint64 _firstTxNonce = confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNonce = confirmedSignedBatch.lastTxNonceId;

        TxDataInfo[] memory _txHashes = new TxDataInfo[](_lastTxNonce - _firstTxNonce + 1);
        for (uint64 i = _firstTxNonce; i <= _lastTxNonce; i++) {
            ConfirmedTransaction storage ctx = confirmedTransactions[_chainId][i];
            _txHashes[i - _firstTxNonce] = TxDataInfo(ctx.sourceChainId, ctx.observedTransactionHash);
        }

        return _txHashes;
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
