// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsManager.sol";
import "hardhat/console.sol";

contract ClaimsSubmitter is IBridgeContractStructs {

    BridgeContract private bridgeContract;
    ClaimsManager private claimsManager;

    // Blockchain ID -> claimsCounter
    mapping(string => uint64) public claimsCounter;    
    // Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // Blockchain -> claimCounter -> claimType
    mapping (string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;
    // TansactionHash -> numberOfVotes
    mapping(string => uint8) public numberOfVotes;

    constructor(address _bridgeContract, address _claimsManager) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsManager = ClaimsManager(_claimsManager);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (claimsManager.isQueuedBRC(_claims.bridgingRequestClaims[i])) {
                revert AlreadyQueued(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.bridgingRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (claimsManager.isQueuedBEC(_claims.batchExecutedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (claimsManager.isQueuedBEFC(_claims.batchExecutionFailedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutionFailedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (claimsManager.isQueuedRRC(_claims.refundRequestClaims[i])) {
                revert AlreadyQueued(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (claimsManager.isQueuedREC(_claims.refundExecutedClaims[i])) {
                revert AlreadyQueued(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.bridgingRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (claimsManager.hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            claimsManager.addToQueuedBridgingRequestsClaims(_claims.bridgingRequestClaims[index]);

            queuedClaims[_claims.bridgingRequestClaims[index].destinationChainID][
                claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]
            ] = _claims.bridgingRequestClaims[index].observedTransactionHash;
            queuedClaimsTypes[_claims.bridgingRequestClaims[index].destinationChainID][
                claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]
            ] = ClaimTypes.BRIDGING_REQUEST;

            claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]++;
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (claimsManager.hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            claimsManager.addToQueuedBatchExecutedClaims(_claims.batchExecutedClaims[index]);

            queuedClaims[_claims.batchExecutedClaims[index].chainID][
                claimsCounter[_claims.batchExecutedClaims[index].chainID]
            ] = _claims.batchExecutedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutedClaims[index].chainID][
                claimsCounter[_claims.batchExecutedClaims[index].chainID]
            ] = ClaimTypes.BATCH_EXECUTED;

            claimsCounter[_claims.batchExecutedClaims[index].chainID]++;

            claimsManager.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutedClaims[index].chainID, -1);

            bridgeContract.updateUTXOs(
                _claims.batchExecutedClaims[index].chainID,
                _claims.batchExecutedClaims[index].outputUTXOs
            );
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutionFailedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (claimsManager.hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            claimsManager.addToQueuedBatchExecutionFailedClaims(
                _claims.batchExecutionFailedClaims[index]);

            queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][
                claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]
            ] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutionFailedClaims[index].chainID][
                claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]
            ] = ClaimTypes.BATCH_EXECUTION_FAILED;

            claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;

            claimsManager.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutionFailedClaims[index].chainID, -1);

            bridgeContract.setNextTimeoutBlock(
                _claims.batchExecutionFailedClaims[index].chainID,
                block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            );
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (claimsManager.hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            claimsManager.addToQueuedRefundRequestClaims(_claims.refundRequestClaims[index]);

            queuedClaims[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = ClaimTypes.REFUND_REQUEST;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            claimsManager.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (claimsManager.hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            claimsManager.addToQueuedRefundExecutedClaims(_claims.refundExecutedClaims[index]);

            queuedClaims[_claims.refundExecutedClaims[index].chainID][
                claimsCounter[_claims.refundExecutedClaims[index].chainID]
            ] = _claims.refundExecutedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundExecutedClaims[index].chainID][
                claimsCounter[_claims.refundExecutedClaims[index].chainID]
            ] = ClaimTypes.REFUND_EXECUTED;

            claimsCounter[_claims.refundExecutedClaims[index].chainID]++;

            claimsManager.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function setVoted(string calldata _id, address _voter, bool _value) external onlyBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(string calldata _id) external onlyBridgeContract {
        numberOfVotes[_id]++;
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }
    
}
