// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";

contract BridgeContractClaimsManager is IBridgeContractStructs {

    // Blockchain ID -> claimsCounter
    mapping(string => uint64) public claimsCounter;
    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) private voted;
    // TansactionHash -> numberOfVotes
    mapping(string => uint8) public numberOfVotes;
    uint8 public validatorsCount;

    //  claimHash -> claim
    mapping(string => BridgingRequestClaim) internal queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) internal queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) internal queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) internal queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) internal queuedRefundExecutedClaims;

    // Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) internal queuedClaims;
    // Blockchain -> claimCounter -> claimType
    mapping (string => mapping(uint256 => ClaimTypes)) internal queuedClaimsTypes;

    //  Blochchain ID -> blockHash
    mapping(string => string) internal lastObserverdBlock;

    function submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) external {
        voted[_claims.bridgingRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash] = _claims
                .bridgingRequestClaims[index];

            queuedClaims[_claims.bridgingRequestClaims[index].sourceChainID][claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]] = 
                _claims.bridgingRequestClaims[index].observedTransactionHash;
            queuedClaimsTypes[_claims.bridgingRequestClaims[index].sourceChainID][claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]] = ClaimTypes.BRIDGING_REQUEST;

            claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]++;
        }
    }

    function submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) external {
        voted[_claims.batchExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            queuedBatchExecutedClaims[_claims.batchExecutedClaims[index].observedTransactionHash] = _claims
                .batchExecutedClaims[index];

            queuedClaims[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = _claims.batchExecutedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = ClaimTypes.BATCH_EXECUTED;

            claimsCounter[_claims.batchExecutedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) external {
        voted[_claims.batchExecutionFailedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            queuedBatchExecutionFailedClaims[_claims.batchExecutionFailedClaims[index].observedTransactionHash] = _claims
                .batchExecutionFailedClaims[index];

            queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = ClaimTypes.BATCH_EXECUTION_FAILED;

            claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) external {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            queuedRefundRequestClaims[_claims.refundRequestClaims[index].observedTransactionHash] = _claims
                .refundRequestClaims[index];

            queuedClaims[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = ClaimTypes.REFUND_REQUEST;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) external {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
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

            lastObserverdBlock[chainId] = _claims.blockHash;
        }
    }
    
    function isQueuedBRC(BridgingRequestClaim calldata _claim) external view returns (bool) {
        return
            keccak256(abi.encode(_claim)) ==
            keccak256(abi.encode(queuedBridgingRequestsClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEC(BatchExecutedClaim calldata _claim) external view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) external view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutionFailedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedRRC(RefundRequestClaim calldata _claim) external view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundRequestClaims[_claim.observedTransactionHash]));
    }

    function isQueuedREC(RefundExecutedClaim calldata _claim) external view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundExecutedClaims[_claim.observedTransactionHash]));     
    }

    function hasVoted(string calldata _id, address _caller) external view returns (bool) {
        return voted[_id][_caller];
    }

    function hasConsensus(string calldata _id) external view returns (bool) {
        return _hasConsensus(_id);
    }

    function _hasConsensus(string calldata _id) internal view returns (bool) {
        if (numberOfVotes[_id] >= ((validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }
    
    function getVote(string calldata _id, address _voter) external view returns (bool) {
        return voted[_id][_voter];
    }

    function getLastObserveredBlock(string calldata _sourceChain) external view returns (string memory blockHash) {
        return lastObserverdBlock[_sourceChain];
    }

    function getQueuedClaimsTypes(string calldata _chainId, uint256 _index) external view returns (ClaimTypes) {
        return queuedClaimsTypes[_chainId][_index];
    }

    function setValidatorsCount(uint8 _validatorsCount) external {
        validatorsCount = _validatorsCount;
    }

    function setVoted(string calldata _id, address _voter, bool _value) external {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(string calldata _id) external {
        numberOfVotes[_id]++;
    }
}