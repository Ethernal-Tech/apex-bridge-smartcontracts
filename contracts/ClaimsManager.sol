// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ValidatorsContract.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {
    ValidatorsContract private validatorsContract;
    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    UTXOsManager private utxosManager;
    address private signedBatchManager;
    address private owner;

    // BlockchainID -> claimsCounter
    mapping(string => uint256) public claimsCounter;
    // BlockchainID -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // BlockchainID -> claimCounter -> claimType
    mapping(string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    mapping(string => uint256) public chainTokenQuantity;

    // ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    // chainID -> nonce -> ConfirmedTransaction
    mapping(string => mapping(uint256 => ConfirmedTransaction)) private confirmedTransactions;

    // chainID -> nonce (nonce of the last confirmed transaction)
    mapping(string => uint256) private lastConfirmedTxNonce;

    // chainID -> nonce (nonce of the last transaction from the executed batch)
    mapping(string => uint256) private lastBatchedTxNonce;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // BlockchainID -> ConfirmedBatch
    mapping(string => ConfirmedBatch) public lastConfirmedBatch;

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => SignedBatch)) public confirmedSignedBatches;

    string private constant LAST_OBSERVED_BLOCK_INFO_KEY = "LAST_OBSERVED_BLOCK_INFO";

    constructor(address _bridgeContract, address _claimsHelper, address _validatorsContract, address _signedBatchManager) {
        owner = msg.sender;
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
        validatorsContract = ValidatorsContract(_validatorsContract);
        signedBatchManager = _signedBatchManager;
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.sourceChainID)) {
                revert ChainIsNotRegistered(_claim.sourceChainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            if (chainTokenQuantity[_claim.sourceChainID] < getNeededTokenQuantity(_claim.receivers)) {
                revert NotEnoughBridgingTokensAwailable(_claim.observedTransactionHash);
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.chainID)) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.chainID)) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            RefundRequestClaim memory _claim = _claims.refundRequestClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.chainID)) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.chainID)) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsCounter[_claim.destinationChainID]++;

            chainTokenQuantity[_claim.sourceChainID] -= getNeededTokenQuantity(_claim.receivers);

            claimsHelper.addToQueuedBridgingRequestsClaims(_claim);

            queuedClaims[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = _claim
                .observedTransactionHash;

            queuedClaimsTypes[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = ClaimTypes
                .BRIDGING_REQUEST;

            utxosManager.addNewBridgingUTXO(_claim.sourceChainID, _claim.outputUTXO);

            _setConfirmedTransactions(_claim);

            claimsHelper.setClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash);
            //int256 currentBatchBlock = currentBatchBlock[_claim.destinationChainID];
            uint256 confirmedTxCount = bridgeContract.getBatchingTxsCount(_claim.destinationChainID);
            if (
                (currentBatchBlock[_claim.destinationChainID] != -1) && // check if there is no batch in progress
                (confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number > bridgeContract.nextTimeoutBlock(_claim.destinationChainID))
            ) // check if the current block number is greater than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                bridgeContract.setNextTimeoutBlock(_claim.destinationChainID, block.number);
            }
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            chainTokenQuantity[_claim.chainID] += getTokenAmountFromSignedBatch(_claim.chainID, _claim.batchNonceID);

            claimsHelper.addToQueuedBatchExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            currentBatchBlock[_claim.chainID] = int(-1);

            SignedBatch memory confirmedSignedBatch = getConfirmedSignedBatch(
                _claim.chainID,
                _claim.batchNonceID
            );
            uint256 txLength = confirmedSignedBatch.includedTransactions.length;
            if (txLength > 0) {
                lastBatchedTxNonce[_claim.chainID] = confirmedSignedBatch.includedTransactions[txLength - 1];
            }

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number);

            utxosManager.addUTXOs(_claim.chainID, _claim.outputUTXOs);
            utxosManager.removeUsedUTXOs(_claim.chainID, confirmedSignedBatch.usedUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            currentBatchBlock[_claim.chainID] = int(-1);

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number);
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundRequestClaim memory _claim = _claims.refundRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundRequestClaims(_claim);

            queuedClaims[_claim.chainID][claimsCounter[_claim.chainID]] = _claim.observedTransactionHash;

            queuedClaimsTypes[_claim.chainID][claimsCounter[_claim.chainID]] = ClaimTypes.REFUND_REQUEST;

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            claimsCounter[_claim.chainID]++;
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim) internal {
        // passed the claim with the memory keyword
        uint256 nextNonce = ++lastConfirmedTxNonce[_claim.destinationChainID];
        confirmedTransactions[_claim.destinationChainID][nextNonce].observedTransactionHash = _claim.observedTransactionHash;
        confirmedTransactions[_claim.destinationChainID][nextNonce].nonce = nextNonce;

        for (uint i = 0; i < _claim.receivers.length; i++) {
            confirmedTransactions[_claim.destinationChainID][nextNonce].receivers.push(_claim.receivers[i]);
        }

        confirmedTransactions[_claim.destinationChainID][nextNonce].blockHeight = block.number;
    }

    function isBatchCreated(string calldata _destinationChain) public view onlyBridgeContract returns (bool batch) {
        return currentBatchBlock[_destinationChain] != int(-1);
    }

    function isBatchAlreadySubmittedBy(
        string calldata _destinationChain,
        address addr
    ) public view onlyBridgeContract returns (bool ok) {
        return voted[Strings.toString(lastConfirmedBatch[_destinationChain].id + 1)][addr];
    }

    function getNewBatchId(string calldata _destinationChain) public view onlyBridgeContract returns (uint256 v) {
        return lastConfirmedBatch[_destinationChain].id + 1;
    }

    function getConfirmedBatch(string calldata _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    function getRawTransactionFromLastBatch(string calldata _destinationChain) external view returns (string memory) {
        return lastConfirmedBatch[_destinationChain].rawTransaction;
    }

    function setVoted(
        string calldata _id,
        address _voter,
        bool _value
    ) external onlySignedBatchManagerOrBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(bytes32 _hash) external onlySignedBatchManagerOrBridgeContract {
        numberOfVotes[_hash]++;
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridgeContract {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    function setConfirmedSignedBatches(string calldata _chainId, uint256 _signedBatchId, SignedBatch calldata _signedBatch) external onlySignedBatchManager {
        confirmedSignedBatches[_chainId][_signedBatchId] = _signedBatch;
    }

    function getLastConfirmedTxNonce(string calldata _destinationChain) public view returns (uint256) {
        return lastConfirmedTxNonce[_destinationChain];
    }

    function setLastConfirmedBatch(string calldata _chainID, ConfirmedBatch memory _confirmedBatch) external onlySignedBatchManager {
        lastConfirmedBatch[_chainID] = _confirmedBatch;
    }

    function getConfirmedTransaction(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (ConfirmedTransaction memory) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getConfirmedSignedBatch(
        string memory _destinationChain,
        uint256 _nonce
    ) private view returns (SignedBatch memory signedBatch) {
        return confirmedSignedBatches[_destinationChain][_nonce];
    }

    function getTokenAmountFromSignedBatch(
        string memory _destinationChain,
        uint256 _nonce
    ) public view returns (uint256) {
        uint256 bridgedAmount;

        uint256[] memory _nonces = getConfirmedSignedBatch(_destinationChain, _nonce)
            .includedTransactions;
        for (uint i = 0; i < _nonces.length; i++) {
            bridgedAmount += getNeededTokenQuantity(confirmedTransactions[_destinationChain][_nonces[i]].receivers);
        }

        return bridgedAmount;
    }

    function getLastBatchedTxNonce(string calldata _destinationChain) public view returns (uint256) {
        return lastBatchedTxNonce[_destinationChain];
    }

    function getLastConfirmedBatch(string calldata _chainId) external view returns (ConfirmedBatch memory) {
        return lastConfirmedBatch[_chainId];
    }

    function setCurrentBatchBlock(string calldata _chainId, int value) external onlySignedBatchManager {
        currentBatchBlock[_chainId] = value;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyBridgeContract {
        currentBatchBlock[_chainId] = int(-1);
    }

    function hasConsensus(bytes32 _hash) public view returns (bool) {
        return numberOfVotes[_hash] >= validatorsContract.getQuorumNumberOfValidators();
    }

    function getNeededTokenQuantity(Receiver[] memory _receivers) internal pure returns (uint256) {
        uint256 tokenQuantity;

        for (uint256 i = 0; i < _receivers.length; i++) {
            tokenQuantity += _receivers[i].amount;
        }

        return tokenQuantity;
    }

    // TODO: who will set this value?
    function setUTXOsManager(address _utxosManager) external onlyOwner {
        utxosManager = UTXOsManager(_utxosManager);
    }

    modifier onlyOwner() {
        if (msg.sender != address(owner)) revert NotOwner();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != address(this)) revert NotClaimsManager();
        _;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlySignedBatchManager() {
        if (msg.sender != signedBatchManager)
            revert NotSignedBatchManager();
        _;
    }

    modifier onlySignedBatchManagerOrBridgeContract() {
        if (msg.sender != signedBatchManager && msg.sender != address(bridgeContract))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
