// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Bridge.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";
import "hardhat/console.sol";

contract Claims is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

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

    mapping(uint8 => uint64) public nextUnprunedConfirmedTransaction;

    // Minimal number of confirmed transaction to be kept at all times
    uint64 public constant MIN_NUMBER_OF_TRANSACTIONS = 2; //TODO SET THIS VALUE TO AGREED ON

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        uint16 _maxNumberOfTransactions,
        uint8 _timeoutBlocksNumber
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
        for (uint i; i < bridgingRequestClaimsLength; i++) {
            console.log("USAO 1");
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            uint8 sourceChainId = _claim.sourceChainId;
            uint8 destinationChainId = _claim.destinationChainId;

            if (!isChainRegistered[sourceChainId]) {
                revert ChainIsNotRegistered(sourceChainId);
            }
            console.log("USAO 3");
            if (!isChainRegistered[destinationChainId]) {
                revert ChainIsNotRegistered(destinationChainId);
            }
            console.log("USAO 3");

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
        console.log("USAO 4");
        uint256 _quorumCnt = validators.getQuorumNumberOfValidators();
        bytes32 _claimHash = keccak256(abi.encode("BRC", _claim));
        if (claimsHelper.isVoteRestricted(_caller, _claimHash, _quorumCnt)) {
            return;
        }
        console.log("USAO 5");
        uint256 _receiversSum = _claim.totalAmount;
        uint8 _destinationChainId = _claim.destinationChainId;

        if (chainTokenQuantity[_destinationChainId] < _receiversSum) {
            emit NotEnoughFunds("BRC", i, chainTokenQuantity[_destinationChainId]);
            return;
        }
        console.log("USAO 6");
        uint256 _votesCnt = claimsHelper.setVoted(_caller, _claimHash);

        if (_votesCnt == _quorumCnt) {
            console.log("USAO 7");
            chainTokenQuantity[_destinationChainId] -= _receiversSum;
            chainTokenQuantity[_claim.sourceChainId] += _receiversSum;

            uint256 _confirmedTxCount = getBatchingTxsCount(_destinationChainId);

            _setConfirmedTransactions(_claim);

            if (
                (claimsHelper.currentBatchBlock(_destinationChainId) == -1) && // there is no batch in progress
                (_confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number >= nextTimeoutBlock[_destinationChainId])
            ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[_destinationChainId] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        // The BatchExecutionInfo event should be emitted even if the validator has already voted
        // or if consensus has already been reached. Same goes for BEFC
        bytes32 claimHash = keccak256(abi.encode("BEC", _claim));
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;
        ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );
        uint64 _firstTxNounce = confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNounce = confirmedSignedBatch.lastTxNonceId;

        _emitBatchExecutionInfo(batchId, chainId, false, _firstTxNounce, _lastTxNounce);

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            claimsHelper.resetCurrentBatchBlock(chainId);

            lastBatchedTxNonce[chainId] = confirmedSignedBatch.lastTxNonceId;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("BEFC", _claim));
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;
        ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );
        uint64 _firstTxNounce = confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNounce = confirmedSignedBatch.lastTxNonceId;

        _emitBatchExecutionInfo(batchId, chainId, true, _firstTxNounce, _lastTxNounce);

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            claimsHelper.resetCurrentBatchBlock(chainId);

            for (uint64 i = _firstTxNounce; i <= _lastTxNounce; i++) {
                chainTokenQuantity[chainId] += confirmedTransactions[chainId][i].totalAmount;
            }

            lastBatchedTxNonce[chainId] = _lastTxNounce;
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
            if (_claim.isIncrement) {
                chainTokenQuantity[chainId] += changeAmount;
            } else if (chainTokenQuantity[chainId] >= changeAmount) {
                chainTokenQuantity[chainId] -= changeAmount;
            } else {
                emit InsufficientFunds(chainTokenQuantity[chainId], changeAmount);
            }
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim calldata _claim) internal {
        console.log("USAO 10");
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];
        confirmedTransactions[destinationChainId][nextNonce].observedTransactionHash = _claim.observedTransactionHash;
        confirmedTransactions[destinationChainId][nextNonce].sourceChainId = _claim.sourceChainId;
        confirmedTransactions[destinationChainId][nextNonce].nonce = nextNonce;
        confirmedTransactions[destinationChainId][nextNonce].retryCounter = _claim.retryCounter;

        uint256 receiversLength = _claim.receivers.length;
        uint256 tokenQuantity;
        for (uint i; i < receiversLength; i++) {
            confirmedTransactions[destinationChainId][nextNonce].receivers.push(_claim.receivers[i]);
            tokenQuantity += _claim.receivers[i].amount;
        }

        confirmedTransactions[destinationChainId][nextNonce].totalAmount = tokenQuantity;

        confirmedTransactions[destinationChainId][nextNonce].blockHeight = block.number;
    }

    function _emitBatchExecutionInfo(
        uint64 _batchID,
        uint8 _chainId,
        bool _isFailedClaim,
        uint64 _firstTxNonce,
        uint64 _lastTxNounce
    ) private {
        TxDataInfo[] memory _txHashes = new TxDataInfo[](_lastTxNounce - _firstTxNonce + 1);
        for (uint64 i = _firstTxNonce; i <= _lastTxNounce; i++) {
            _txHashes[i - _firstTxNonce] = TxDataInfo(
                confirmedTransactions[_chainId][i].sourceChainId,
                confirmedTransactions[_chainId][i].observedTransactionHash
            );
        }

        emit BatchExecutionInfo(_batchID, _chainId, _isFailedClaim, _txHashes);
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

        uint256 txsToProcess = ((lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain) >= maxNumberOfTransactions)
            ? maxNumberOfTransactions
            : (lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain);

        counterConfirmedTransactions = 0;

        while (counterConfirmedTransactions < txsToProcess) {
            uint256 blockHeight = confirmedTransactions[_chainId][
                lastBatchedTxNonceForChain + counterConfirmedTransactions + 1
            ].blockHeight;
            if (blockHeight >= nextTimeoutBlock[_chainId]) {
                break;
            }
            counterConfirmedTransactions++;
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

    function getTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return chainTokenQuantity[_chainId];
    }

    function pruneConfirmedTransactions(uint8 _chainId, uint64 _deleteToNonce) external onlyOwner {
        if (
            _deleteToNonce <= MIN_NUMBER_OF_TRANSACTIONS ||
            _deleteToNonce <= (lastConfirmedTxNonce[_chainId] - MIN_NUMBER_OF_TRANSACTIONS)
        ) revert ConfirmedTransactionsProtectedFromPruning();
        if (_deleteToNonce <= nextUnprunedConfirmedTransaction[_chainId]) revert AlreadyPruned();

        for (uint64 i = nextUnprunedConfirmedTransaction[_chainId]; i <= _deleteToNonce; i++) {
            delete confirmedTransactions[_chainId][i];
        }
        nextUnprunedConfirmedTransaction[_chainId] = _deleteToNonce + 1;
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
