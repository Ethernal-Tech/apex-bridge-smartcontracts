// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

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

    // BlockchainID -> bool
    mapping(string => bool) public isChainRegistered;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    uint16 public maxNumberOfTransactions;
    uint8 public timeoutBlocksNumber;

    // BlockchainId -> TokenQuantity
    mapping(string => uint256) public chainTokenQuantity;

    // BlockchainID -> nonce -> ConfirmedTransaction
    mapping(string => mapping(uint256 => ConfirmedTransaction)) private confirmedTransactions;

    // chainID -> nonce (nonce of the last confirmed transaction)
    mapping(string => uint256) public lastConfirmedTxNonce;

    // chainID -> nonce (nonce of the last transaction from the executed batch)
    mapping(string => uint256) public lastBatchedTxNonce;

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
        for (uint i; i < bridgingRequestClaimsLength; ) {
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            if (!isChainRegistered[_claim.sourceChainID]) {
                revert ChainIsNotRegistered(_claim.sourceChainID);
            }

            if (!isChainRegistered[_claim.destinationChainID]) {
                revert ChainIsNotRegistered(_claim.destinationChainID);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (chainTokenQuantity[_claim.sourceChainID] < getNeededTokenQuantity(_claim.receivers)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            _submitClaimsBRC(_claims, i, _caller);

            //prettier-ignore
            unchecked { i++; }
        }

        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        for (uint i; i < batchExecutedClaimsLength; ) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            _submitClaimsBEC(_claims, i, _caller);

            //prettier-ignore
            unchecked { i++; }
        }

        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        for (uint i; i < batchExecutionFailedClaimsLength; ) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            _submitClaimsBEFC(_claims, i, _caller);
            //prettier-ignore
            unchecked { i++; }
        }

        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        for (uint i; i < refundRequestClaimsLength; ) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            _submitClaimsRRC(_claims, i, _caller);
            //prettier-ignore
            unchecked { i++; }
        }

        uint256 refundExecutedClaimsLength = _claims.refundExecutedClaims.length;
        for (uint i; i < refundExecutedClaimsLength; ) {
            RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (claimsHelper.hasVoted(_claim.observedTransactionHash, _caller)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                //prettier-ignore
                unchecked { i++; }
                continue;
            }

            _submitClaimsREC(_claims, i, _caller);
            //prettier-ignore
            unchecked { i++; }
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            chainTokenQuantity[_claim.sourceChainID] -= getNeededTokenQuantity(_claim.receivers);

            utxosc.addNewBridgingUTXO(_claim.sourceChainID, _claim.outputUTXO);

            uint256 confirmedTxCount = getBatchingTxsCount(_claim.destinationChainID);

            _setConfirmedTransactions(_claim);
            claimsHelper.setClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash);

            if (
                (claimsHelper.currentBatchBlock(_claim.destinationChainID) == -1) && // there is no batch in progress
                (confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number >= nextTimeoutBlock[_claim.destinationChainID])
            ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[_claim.destinationChainID] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            chainTokenQuantity[_claim.chainID] += getTokenAmountFromSignedBatch(_claim.chainID, _claim.batchNonceID);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            claimsHelper.resetCurrentBatchBlock(_claim.chainID);

            ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                _claim.chainID,
                _claim.batchNonceID
            );

            lastBatchedTxNonce[_claim.chainID] = confirmedSignedBatch.lastTxNonceId;

            nextTimeoutBlock[_claim.chainID] = block.number + timeoutBlocksNumber;

            utxosc.addUTXOs(_claim.chainID, _claim.outputUTXOs);
            utxosc.removeUsedUTXOs(_claim.chainID, confirmedSignedBatch.usedUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            claimsHelper.resetCurrentBatchBlock(_claim.chainID);

            nextTimeoutBlock[_claim.chainID] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundRequestClaim calldata _claim = _claims.refundRequestClaims[index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[index];
        bytes32 claimHash = keccak256(abi.encode(_claim));
        uint256 votesCnt = claimsHelper.setVoted(_claim.observedTransactionHash, _caller, claimHash);

        if (votesCnt >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim calldata _claim) internal {
        uint256 nextNonce = ++lastConfirmedTxNonce[_claim.destinationChainID];
        confirmedTransactions[_claim.destinationChainID][nextNonce].observedTransactionHash = _claim
            .observedTransactionHash;
        confirmedTransactions[_claim.destinationChainID][nextNonce].sourceChainID = _claim.sourceChainID;
        confirmedTransactions[_claim.destinationChainID][nextNonce].nonce = nextNonce;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; ) {
            confirmedTransactions[_claim.destinationChainID][nextNonce].receivers.push(_claim.receivers[i]);

            //prettier-ignore
            unchecked { i++; }
        }

        confirmedTransactions[_claim.destinationChainID][nextNonce].blockHeight = block.number;
    }

    function setVoted(string calldata _id, address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_id, _voter, _hash);
    }

    function isBatchCreated(string calldata _destinationChain) public view returns (bool batch) {
        return claimsHelper.currentBatchBlock(_destinationChain) != int(-1);
    }

    function shouldCreateBatch(string calldata _destinationChain) public view returns (bool) {
        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridge {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    function getConfirmedTransaction(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (ConfirmedTransaction memory) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getBatchingTxsCount(string calldata _chainId) public view returns (uint256 counterConfirmedTransactions) {
        uint256 lastConfirmedTxNonceForChain = lastConfirmedTxNonce[_chainId];
        uint256 lastBatchedTxNonceForChain = lastBatchedTxNonce[_chainId];

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

    function getTokenAmountFromSignedBatch(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (uint256) {
        uint256 bridgedAmount;

        ConfirmedSignedBatchData memory confirmedSignedBatchData = claimsHelper.getConfirmedSignedBatchData(
            _destinationChain,
            _nonce
        );
        uint256 _firstTxNounce = confirmedSignedBatchData.firstTxNonceId;
        uint256 _lastTxNounce = confirmedSignedBatchData.lastTxNonceId;

        for (uint i = _firstTxNounce; i <= _lastTxNounce; ) {
            bridgedAmount += getNeededTokenQuantity(confirmedTransactions[_destinationChain][i].receivers);

            //prettier-ignore
            unchecked { i++; }
        }

        return bridgedAmount;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function getNeededTokenQuantity(Receiver[] memory _receivers) internal pure returns (uint256) {
        uint256 tokenQuantity;

        uint256 receiversLength = _receivers.length;
        for (uint256 i = 0; i < receiversLength; ) {
            tokenQuantity += _receivers[i].amount;

            //prettier-ignore
            unchecked { i++; }
        }

        return tokenQuantity;
    }

    function setChainRegistered(string calldata _chainId) external onlyBridge {
        isChainRegistered[_chainId] = true;
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    function hasVoted(string calldata _id, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_id, _voter);
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
