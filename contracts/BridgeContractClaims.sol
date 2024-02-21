// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";
import "./Helpers.sol";

contract BridgeContractClaims is IBridgeContractStructs, Helpers {
    //  claimHash -> claim
    mapping(string => BridgingRequestClaim) internal queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) internal queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) internal queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) internal queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) internal queuedRefundExecutedClaims;

    // Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint64 => string)) internal queuedClaims;
    //  Blochchain ID -> blockHash
    mapping(string => string) internal lastObserverdBlock;

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.bridgingRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash] = _claims
                .bridgingRequestClaims[index];

            queuedClaims[_claims.bridgingRequestClaims[index].sourceChainID][claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]] = 
                _claims.bridgingRequestClaims[index].observedTransactionHash;

            claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]++;
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.batchExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            queuedBatchExecutedClaims[_claims.batchExecutedClaims[index].observedTransactionHash] = _claims
                .batchExecutedClaims[index];

            queuedClaims[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = _claims.batchExecutedClaims[index].observedTransactionHash;

            claimsCounter[_claims.batchExecutedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.batchExecutionFailedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            queuedBatchExecutionFailedClaims[_claims.batchExecutionFailedClaims[index].observedTransactionHash] = _claims
                .batchExecutionFailedClaims[index];

            queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.refundRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            queuedRefundRequestClaims[_claims.refundRequestClaims[index].observedTransactionHash] = _claims
                .refundRequestClaims[index];

            queuedClaims[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = _claims.refundRequestClaims[index].observedTransactionHash;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            _updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.refundExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            queuedRefundExecutedClaims[_claims.refundExecutedClaims[index].observedTransactionHash] = _claims
                .refundExecutedClaims[index];

             queuedClaims[_claims.refundExecutedClaims[index].chainID][claimsCounter[_claims.refundExecutedClaims[index].chainID]] = _claims.refundExecutedClaims[index].observedTransactionHash;

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
        return _isQueuedBRC(_claim);
    }

    function _isQueuedBRC(BridgingRequestClaim calldata _claim) internal view returns (bool) {
        return
            keccak256(abi.encode(_claim)) ==
            keccak256(abi.encode(queuedBridgingRequestsClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEC(BatchExecutedClaim calldata _claim) external view returns (bool) {
        return _isQueuedBEC(_claim);
    }

    function _isQueuedBEC(BatchExecutedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) external view returns (bool) {
        return _isQueuedBEFC(_claim);
    }

    function _isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutionFailedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedRRC(RefundRequestClaim calldata _claim) external view returns (bool) {
        return _isQueuedRRC(_claim);
    }

    function _isQueuedRRC(RefundRequestClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundRequestClaims[_claim.observedTransactionHash]));
    }

    function isQueuedREC(RefundExecutedClaim calldata _claim) external view returns (bool) {
        return _isQueuedREC(_claim);
    }

    function _isQueuedREC(RefundExecutedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundExecutedClaims[_claim.observedTransactionHash]));     
    }
}