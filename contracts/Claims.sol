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
            if (!isChainRegistered[_claim.originChainId]) {
                revert ChainIsNotRegistered(_claim.originChainId);
            }

            _submitClaimsRRC(_claim, _caller);
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

        uint256 _receiversSum = _claim.totalAmount;
        uint8 _destinationChainId = _claim.destinationChainId;

        if (chainTokenQuantity[_destinationChainId] < _receiversSum) {
            emit NotEnoughFunds("BRC", i, chainTokenQuantity[_destinationChainId]);
            return;
        }

        uint256 _votesCnt = claimsHelper.setVoted(_caller, _claimHash);

        if (_votesCnt == _quorumCnt) {
            chainTokenQuantity[_destinationChainId] -= _receiversSum;

            if (_claim.retryCounter == 0) {
                chainTokenQuantity[_claim.sourceChainId] += _receiversSum;
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
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);

            ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainId,
                batchId
            );
            // do not process included transactions or modify batch creation state if it is a consolidation
            if (_confirmedSignedBatch.isConsolidation) {
                return;
            }

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
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);

            ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainId,
                batchId
            );
            // do not process included transactions or modify batch creation state if it is a consolidation
            if (_confirmedSignedBatch.isConsolidation) {
                return;
            }

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
                }
            }

            lastBatchedTxNonce[chainId] = _lastTxNouce;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(RefundRequestClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("RRC", _claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        uint8 originChainId = _claim.originChainId;

        if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0) {
            if (chainTokenQuantity[originChainId] < _claim.originAmount) {
                emit NotEnoughFunds("RRC", 0, chainTokenQuantity[originChainId]);
                return;
            }
        }

        if (_quorumReached) {
            uint256 _confirmedTxCount = getBatchingTxsCount(originChainId);

            if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0) {
                // refund after failing on destination chain, return originAmount to hot wallet
                chainTokenQuantity[originChainId] -= _claim.originAmount;
            }

            _setConfirmedTransactionsRRC(_claim);

            if (
                (claimsHelper.currentBatchBlock(originChainId) == -1) && // there is no batch in progress
                (_confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number >= nextTimeoutBlock[originChainId])
            ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[originChainId] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimHWIC(HotWalletIncrementClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("HWIC", _claim));

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            chainTokenQuantity[_claim.chainId] += _claim.amount;
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim, uint8 _transactionType) internal {
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];

        ConfirmedTransaction storage confirmedTx = confirmedTransactions[destinationChainId][nextNonce];
        confirmedTx.totalAmount = _claim.totalAmount;
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

        Receiver memory receiver = Receiver(_claim.originAmount, _claim.originSenderAddress);

        confirmedTx.receivers.push(receiver);
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

    function setChainRegistered(uint8 _chainId, uint256 _initialTokenSupply) external onlyBridge {
        isChainRegistered[_chainId] = true;
        chainTokenQuantity[_chainId] = _initialTokenSupply;
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
            totalAmount: _amount,
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

    function getBatchTransactions(uint8 _chainId, uint64 _batchId) external view returns (TxDataInfo[] memory) {
        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            _chainId,
            _batchId
        );
        if (_confirmedSignedBatch.isConsolidation) {
            return new TxDataInfo[](0);
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

        return _txHashes;
    }

    function updateMaxNumberOfTransactions(uint16 _maxNumberOfTransactions) external onlyAdminContract {
        maxNumberOfTransactions = _maxNumberOfTransactions;
    }

    function updateTimeoutBlocksNumber(uint8 _timeoutBlocksNumber) external onlyAdminContract {
        timeoutBlocksNumber = _timeoutBlocksNumber;
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
