// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./ClaimsHelper.sol";
import "./UTXOsc.sol";
import "./Validators.sol";

contract Claims is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    UTXOsc private utxosc;
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
    mapping(uint8 => mapping(uint64 => ConfirmedTransaction)) private confirmedTransactions;

    // chainId -> nonce (nonce of the last confirmed transaction)
    mapping(uint8 => uint64) public lastConfirmedTxNonce;

    // chainId -> nonce (nonce of the last transaction from the executed batch)
    mapping(uint8 => uint64) public lastBatchedTxNonce;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint16 _maxNumberOfTransactions, uint8 _timeoutBlocksNumber) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _utxosc,
        address _validatorsAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        utxosc = UTXOsc(_utxosc);
        validators = Validators(_validatorsAddress);
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

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                continue;
            }

            if (claimsHelper.isClaimConfirmed(destinationChainId, _claim.observedTransactionHash)) {
                continue;
            }

            if (chainTokenQuantity[sourceChainId] < getNeededTokenQuantity(_claim.receivers)) {
                continue;
            }

            _submitClaimsBRC(_claims, i, _caller);
        }

        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainId, _claim.observedTransactionHash)) {
                continue;
            }

            _submitClaimsBEC(_claims, i, _caller);
        }

        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainId, _claim.observedTransactionHash)) {
                continue;
            }

            _submitClaimsBEFC(_claims, i, _caller);
        }

        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainId, _claim.observedTransactionHash)) {
                continue;
            }

            _submitClaimsRRC(_claims, i, _caller);
        }

        uint256 refundExecutedClaimsLength = _claims.refundExecutedClaims.length;
        for (uint i; i < refundExecutedClaimsLength; i++) {
            RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainId, _claim.observedTransactionHash)) {
                continue;
            }

            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 _index, address _caller) internal {
        BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[_index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            uint8 destinationChainId = _claim.destinationChainId;
            chainTokenQuantity[_claim.sourceChainId] -= getNeededTokenQuantity(_claim.receivers);

            utxosc.addNewBridgingUTXO(_claim.sourceChainId, _claim.outputUTXO);

            uint256 confirmedTxCount = getBatchingTxsCount(destinationChainId);

            _setConfirmedTransactions(_claim);
            claimsHelper.setClaimConfirmed(destinationChainId, _claim.observedTransactionHash);

            if (
                (claimsHelper.currentBatchBlock(destinationChainId) == -1) && // there is no batch in progress
                (confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number >= nextTimeoutBlock[destinationChainId])
            ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[destinationChainId] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 _index, address _caller) internal {
        BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[_index];
        bytes32 claimHash = keccak256(abi.encode(_claim));

        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);
        uint8 chainId = _claim.chainId;

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            chainTokenQuantity[chainId] += getTokenAmountFromSignedBatch(chainId, _claim.batchNonceId);

            claimsHelper.setClaimConfirmed(chainId, _claim.observedTransactionHash);

            claimsHelper.resetCurrentBatchBlock(chainId);

            ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainId,
                _claim.batchNonceId
            );

            lastBatchedTxNonce[chainId] = confirmedSignedBatch.lastTxNonceId;

            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;

            utxosc.addUTXOs(chainId, _claim.outputUTXOs);
            utxosc.removeUsedUTXOs(chainId, confirmedSignedBatch.usedUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 _index, address _caller) internal {
        BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[_index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);
        uint8 chainId = _claim.chainId;

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(chainId, _claim.observedTransactionHash);

            claimsHelper.resetCurrentBatchBlock(chainId);

            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 _index, address _caller) internal {
        RefundRequestClaim calldata _claim = _claims.refundRequestClaims[_index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(_claim.chainId, _claim.observedTransactionHash);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 _index, address _caller) internal {
        RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[_index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(_claim.chainId, _claim.observedTransactionHash);
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim calldata _claim) internal {
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];
        confirmedTransactions[destinationChainId][nextNonce].observedTransactionHash = _claim.observedTransactionHash;
        confirmedTransactions[destinationChainId][nextNonce].sourceChainId = _claim.sourceChainId;
        confirmedTransactions[destinationChainId][nextNonce].nonce = nextNonce;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; i++) {
            confirmedTransactions[destinationChainId][nextNonce].receivers.push(_claim.receivers[i]);
        }

        confirmedTransactions[destinationChainId][nextNonce].blockHeight = block.number;
    }

    function setVoted(bytes32 _id, address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_id, _voter, _hash);
    }

    function isBatchCreated(uint8 _destinationChain) public view returns (bool batch) {
        return claimsHelper.currentBatchBlock(_destinationChain) != int(-1);
    }

    function shouldCreateBatch(uint8 _destinationChain) public view returns (bool) {
        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function setTokenQuantity(uint8 _chainId, uint256 _tokenQuantity) external onlyBridge {
        chainTokenQuantity[_chainId] = _tokenQuantity;
    }

    function getConfirmedTransaction(
        uint8 _destinationChain,
        uint64 _nonce
    ) public view returns (ConfirmedTransaction memory) {
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

    function getTokenAmountFromSignedBatch(uint8 _destinationChain, uint64 _nonce) public view returns (uint256) {
        uint256 bridgedAmount;

        ConfirmedSignedBatchData memory confirmedSignedBatchData = claimsHelper.getConfirmedSignedBatchData(
            _destinationChain,
            _nonce
        );
        uint64 _firstTxNounce = confirmedSignedBatchData.firstTxNonceId;
        uint64 _lastTxNounce = confirmedSignedBatchData.lastTxNonceId;

        for (_firstTxNounce; _firstTxNounce <= _lastTxNounce; _firstTxNounce++) {
            bridgedAmount += getNeededTokenQuantity(confirmedTransactions[_destinationChain][_firstTxNounce].receivers);
        }

        return bridgedAmount;
    }

    function resetCurrentBatchBlock(uint8 _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function getNeededTokenQuantity(Receiver[] memory _receivers) internal pure returns (uint256) {
        uint256 tokenQuantity;

        uint256 receiversLength = _receivers.length;
        for (uint256 i = 0; i < receiversLength; i++) {
            tokenQuantity += _receivers[i].amount;
        }

        return tokenQuantity;
    }

    function setChainRegistered(uint8 _chainId) external onlyBridge {
        isChainRegistered[_chainId] = true;
    }

    function setNextTimeoutBlock(uint8 _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    function hasVoted(bytes32 _id, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_id, _voter);
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
