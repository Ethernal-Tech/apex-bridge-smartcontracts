// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    SignedBatchManager private signedBatchManager;
    UTXOsManager private utxosManager;

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

    string private constant LAST_OBSERVED_BLOCK_INFO_KEY = "LAST_OBSERVED_BLOCK_INFO";

    constructor(address _bridgeContract, address _claimsHelper) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[i];
            if (!bridgeContract.isChainRegistered(_claim.sourceChainID)) {
                revert ChainIsNotRegistered(_claim.sourceChainID);
            }

            if (!bridgeContract.isChainRegistered(_claim.destinationChainID)) {
                revert ChainIsNotRegistered(_claim.destinationChainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            if (!claimsHelper.isThereEnoughTokensToBridge(_claim)) {
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

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsCounter[_claim.destinationChainID]++;

            chainTokenQuantity[_claim.sourceChainID] -= claimsHelper.getNeededTokenQuantity(_claim.receivers);

            claimsHelper.addToQueuedBridgingRequestsClaims(_claim);

            queuedClaims[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = _claim
                .observedTransactionHash;

            queuedClaimsTypes[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = ClaimTypes
                .BRIDGING_REQUEST;
            
            utxosManager.addNewBridgingUTXO(_claim.destinationChainID, _claim.outputUTXO);

            _setConfirmedTransactions(_claim);

            claimsHelper.setClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash);
            int256 currentBatchBlock = signedBatchManager.currentBatchBlock(_claim.destinationChainID);
            uint256 confirmedTxCount = bridgeContract.getBatchingTxsCount(_claim.destinationChainID);
            if (
                (currentBatchBlock != -1) && // check if there is no batch in progress
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

        if (claimsHelper.hasConsensus(claimHash)) {
            chainTokenQuantity[_claim.chainID] += signedBatchManager.getTokenQuantityFromSignedBatch(
                _claim.chainID,
                _claim.batchNonceID
            );

            claimsHelper.addToQueuedBatchExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            signedBatchManager.resetCurrentBatchBlock(_claim.chainID);

            SignedBatch memory confirmedSignedBatch = signedBatchManager.getConfirmedSignedBatch(
                _claim.chainID,
                _claim.batchNonceID
            );
            uint256 txLength = confirmedSignedBatch.includedTransactions.length;
            if (txLength > 0) {
                lastBatchedTxNonce[_claim.chainID] = confirmedSignedBatch.includedTransactions[txLength - 1];
            }

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number);

            utxosManager.updateUTXOs(_claim.chainID, _claim.outputUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            signedBatchManager.resetCurrentBatchBlock(_claim.chainID);

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number);
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundRequestClaim memory _claim = _claims.refundRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
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

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim) internal {
        // passed the claim with the memory keyword
        uint256 nextNonce = ++lastConfirmedTxNonce[_claim.destinationChainID];
        confirmedTransactions[_claim.destinationChainID][nextNonce].nonce = nextNonce;

        for (uint i = 0; i < _claim.receivers.length; i++) {
            confirmedTransactions[_claim.destinationChainID][nextNonce].receivers.push(_claim.receivers[i]);
        }

        confirmedTransactions[_claim.destinationChainID][nextNonce].blockHeight = block.number;
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

    // TODO: who will set this value?
    function setUTXOsManager(address _utxosManager) external {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setSignedBatchManager(address _signedBatchManager) external {
        signedBatchManager = SignedBatchManager(_signedBatchManager);
    }

    function getLastConfirmedTxNonce(string calldata _destinationChain) public view returns (uint256) {
        return lastConfirmedTxNonce[_destinationChain];
    }

    function getConfirmedTransaction(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (ConfirmedTransaction memory) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getConfirmedTransactionAmount(string calldata _destinationChain, uint256 _nonce) public view returns (uint256 result) {
        ConfirmedTransaction memory ctx = confirmedTransactions[_destinationChain][_nonce];
        for (uint256 j = 0; j < ctx.receivers.length; j++) {
            result += ctx.receivers[j].amount;
        }
        return result;
    }

    function getLastBatchedTxNonce(string calldata _destinationChain) public view returns (uint256) {
        return lastBatchedTxNonce[_destinationChain];
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlySignedBatchManagerOrBridgeContract() {
        if (msg.sender != address(signedBatchManager) && msg.sender != address(bridgeContract))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
