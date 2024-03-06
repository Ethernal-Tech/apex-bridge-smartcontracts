// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {

    // Blockchain ID -> claimsCounter
    mapping(string => uint64) public claimsCounter;
    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;
    // TansactionHash -> numberOfVotes
    mapping(string => uint8) public numberOfVotes;
    uint8 public validatorsCount;

    //  flaimHash -> claim
    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) public queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) public queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) public queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) public queuedRefundExecutedClaims;

    // Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // Blockchain -> claimCounter -> claimType
    mapping (string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    //  Blochchain ID -> blockHash
    mapping(string => string) public lastObserveredBlock;

    BridgeContract private bridgeContract;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (isQueuedBRC(_claims.bridgingRequestClaims[i])) {
                revert AlreadyQueued(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.bridgingRequestClaims[i].observedTransactionHash][ _caller]) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (isQueuedBEC(_claims.batchExecutedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (isQueuedBEFC(_claims.batchExecutionFailedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutionFailedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (isQueuedRRC(_claims.refundRequestClaims[i])) {
                revert AlreadyQueued(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (isQueuedREC(_claims.refundExecutedClaims[i])) {
                revert AlreadyQueued(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            submitClaimsREC(_claims, i, _caller);
        }
    }

    function submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.bridgingRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash] = _claims
                .bridgingRequestClaims[index];

            queuedClaims[_claims.bridgingRequestClaims[index].destinationChainID][claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]] = 
                _claims.bridgingRequestClaims[index].observedTransactionHash;
            queuedClaimsTypes[_claims.bridgingRequestClaims[index].destinationChainID][claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]] = ClaimTypes.BRIDGING_REQUEST;

            claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]++;
        }
    }

    function submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            queuedBatchExecutedClaims[_claims.batchExecutedClaims[index].observedTransactionHash] = _claims
                .batchExecutedClaims[index];

            queuedClaims[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = _claims.batchExecutedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = ClaimTypes.BATCH_EXECUTED;

            claimsCounter[_claims.batchExecutedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutedClaims[index].chainID, -1);

            bridgeContract.updateUTXOs(_claims.batchExecutedClaims[index].chainID, _claims.batchExecutedClaims[index].outputUTXOs);
            
        }
    }

    function submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutionFailedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            queuedBatchExecutionFailedClaims[_claims.batchExecutionFailedClaims[index].observedTransactionHash] = _claims
                .batchExecutionFailedClaims[index];

            queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = ClaimTypes.BATCH_EXECUTION_FAILED;

            claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            queuedRefundRequestClaims[_claims.refundRequestClaims[index].observedTransactionHash] = _claims
                .refundRequestClaims[index];

            queuedClaims[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = ClaimTypes.REFUND_REQUEST;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            queuedRefundExecutedClaims[_claims.refundExecutedClaims[index].observedTransactionHash] = _claims
                .refundExecutedClaims[index];

            queuedClaims[_claims.refundExecutedClaims[index].chainID][claimsCounter[_claims.refundExecutedClaims[index].chainID]] = _claims.refundExecutedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundExecutedClaims[index].chainID][claimsCounter[_claims.refundExecutedClaims[index].chainID]] = ClaimTypes.REFUND_EXECUTED;

            claimsCounter[_claims.refundExecutedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _updateLastObservedBlockIfNeeded(ValidatorClaims calldata _claims) internal {
        if (_claims.blockFullyObserved) {
            string memory chainId;
            if(_claims.bridgingRequestClaims.length > 0) {
                chainId = _claims.bridgingRequestClaims[0].sourceChainID;
            } else if(_claims.batchExecutedClaims.length > 0) {
                chainId = _claims.batchExecutedClaims[0].chainID;
            } else if(_claims.batchExecutionFailedClaims.length > 0) {
                chainId = _claims.batchExecutionFailedClaims[0].chainID;
            } else if(_claims.refundRequestClaims.length > 0) {
                chainId = _claims.refundRequestClaims[0].chainID;
            } else if(_claims.refundExecutedClaims.length > 0) {
                chainId = _claims.refundExecutedClaims[0].chainID;
            }

            lastObserveredBlock[chainId] = _claims.blockHash;
        }
    }
    
    function isQueuedBRC(BridgingRequestClaim calldata _claim) public view returns (bool) {
        return
            keccak256(abi.encode(_claim)) ==
            keccak256(abi.encode(queuedBridgingRequestsClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEC(BatchExecutedClaim calldata _claim) public view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) public view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutionFailedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedRRC(RefundRequestClaim calldata _claim) public view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundRequestClaims[_claim.observedTransactionHash]));
    }

    function isQueuedREC(RefundExecutedClaim calldata _claim) public view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundExecutedClaims[_claim.observedTransactionHash]));     
    }

    function hasConsensus(string calldata _id) public view returns (bool) {
        if (numberOfVotes[_id] >= ((validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }

    function getClaimBRC(string calldata _id) external view returns (BridgingRequestClaim memory claim) {
        return queuedBridgingRequestsClaims[_id];
    }
    
    function setValidatorsCount(uint8 _validatorsCount) external onlyBridgeContract {
        validatorsCount = _validatorsCount;
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