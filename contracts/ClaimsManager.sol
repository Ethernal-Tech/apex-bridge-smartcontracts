// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./UTXOsManager.sol";
import "./BridgedTokensManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {

    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    UTXOsManager private utxosManager;
    BridgedTokensManager private bridgedTokensManager;

    // Blockchain ID -> claimsCounter
    mapping(string => uint256) public claimsCounter;
    // Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // Blockchain -> claimCounter -> claimType
    mapping (string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    //batchID -> voterAddress

    // TansactionHash -> numberOfVotes
    mapping(string => uint8) public numberOfVotes;

    constructor(address _bridgeContract, address _claimsHelper) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (!claimsHelper.isThereEnoughTokensToBridge(_claims.bridgingRequestClaims[i])) {
                revert NotEnoughBridgingTokensAwailable(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            if (claimsHelper.isQueuedBRC(_claims.bridgingRequestClaims[i])) {
                revert AlreadyQueued(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            if (voted[_claims.bridgingRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (claimsHelper.isQueuedBEC(_claims.batchExecutedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (claimsHelper.isQueuedBEFC(_claims.batchExecutionFailedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutionFailedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (claimsHelper.isQueuedRRC(_claims.refundRequestClaims[i])) {
                revert AlreadyQueued(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (claimsHelper.isQueuedREC(_claims.refundExecutedClaims[i])) {
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

        if (claimsHelper.hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            // TODO: At this point in time transaction is not yet executed and tokens are
            // still not bridged. Would it make more sence to do this with BridgeExecutedClaims
            // in that case we would need to be able to track the amount from there
            // On other hand, doing it here would make sence also since, new BridgeRequestClaims
            // will not be put in queue if there is already a claim that would make the new ones
            // invalid

            uint256 tokenQuantity;

            for (uint256 i = 0; i < _claims.bridgingRequestClaims[index].receivers.length; i++) {
                tokenQuantity +=_claims.bridgingRequestClaims[index].receivers[i].amount;
            }

            bridgedTokensManager.registerTokensTransfer(_claims.bridgingRequestClaims[index], tokenQuantity);

            claimsHelper.addToQueuedBridgingRequestsClaims(_claims.bridgingRequestClaims[index]);

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

        if (claimsHelper.hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedBatchExecutedClaims(_claims.batchExecutedClaims[index]);

            // queuedClaims[_claims.batchExecutedClaims[index].chainID][
            //     claimsCounter[_claims.batchExecutedClaims[index].chainID]
            // ] = _claims.batchExecutedClaims[index].observedTransactionHash;

            // queuedClaimsTypes[_claims.batchExecutedClaims[index].chainID][
            //     claimsCounter[_claims.batchExecutedClaims[index].chainID]
            // ] = ClaimTypes.BATCH_EXECUTED;

            // claimsCounter[_claims.batchExecutedClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutedClaims[index].chainID, -1);

            bridgeContract.setNextTimeoutBlock(
                _claims.batchExecutedClaims[index].chainID,
                block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            );

            utxosManager.updateUTXOs(
                _claims.batchExecutedClaims[index].chainID,
                _claims.batchExecutedClaims[index].outputUTXOs
            );
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutionFailedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(
                _claims.batchExecutionFailedClaims[index]);

            // queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][
            //     claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]
            // ] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            // queuedClaimsTypes[_claims.batchExecutionFailedClaims[index].chainID][
            //     claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]
            // ] = ClaimTypes.BATCH_EXECUTION_FAILED;

            // claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutionFailedClaims[index].chainID, -1);

            // bridgeContract.setNextTimeoutBlock(
            //     _claims.batchExecutionFailedClaims[index].chainID,
            //     block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            // );
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedRefundRequestClaims(_claims.refundRequestClaims[index]);

            queuedClaims[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = ClaimTypes.REFUND_REQUEST;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claims.refundExecutedClaims[index]);

            // queuedClaims[_claims.refundExecutedClaims[index].chainID][
            //     claimsCounter[_claims.refundExecutedClaims[index].chainID]
            // ] = _claims.refundExecutedClaims[index].observedTransactionHash;

            // queuedClaimsTypes[_claims.refundExecutedClaims[index].chainID][
            //     claimsCounter[_claims.refundExecutedClaims[index].chainID]
            // ] = ClaimTypes.REFUND_EXECUTED;

            // claimsCounter[_claims.refundExecutedClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function setVoted(string calldata _id, address _voter, bool _value) external onlyBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(string calldata _id) external onlyBridgeContract {
        numberOfVotes[_id]++;
    }

    // TODO: who will set this value?
    function setUTXOsManager(address _utxosManager) external {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setBridgedTokensManager(address _bridgedTokensManager) external {
        bridgedTokensManager = BridgedTokensManager(_bridgedTokensManager);
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }
    
}
