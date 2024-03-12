// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsManager.sol";
import "hardhat/console.sol";

contract ClaimsHelper is IBridgeContractStructs {

    //  claimHash -> claim
    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) public queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) public queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) public queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) public queuedRefundExecutedClaims;

    //  Blochchain ID -> blockHash
    mapping(string => string) public lastObserveredBlock;

    BridgeContract private bridgeContract;
    ClaimsManager private claimsManager;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function updateLastObservedBlockIfNeeded(ValidatorClaims calldata _claims) external onlyClaimsManager{
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
    
    // TODO: claims might differ if inluding signature, check the claims and implement
    // different way of comparison
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
        if (claimsManager.numberOfVotes(_id) >= ((bridgeContract.validatorsCount() * 2) / 3 + ((bridgeContract.validatorsCount() * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }

    function getClaimBRC(string calldata _id) external view returns (BridgingRequestClaim memory claim) {
        return queuedBridgingRequestsClaims[_id];
    }

    function addToQueuedBridgingRequestsClaims(BridgingRequestClaim calldata _claim) external onlyClaimsManager {
        queuedBridgingRequestsClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedBatchExecutedClaims(BatchExecutedClaim calldata _claim) external onlyClaimsManager {
        queuedBatchExecutedClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedRefundRequestClaims(RefundRequestClaim calldata _claim) external onlyClaimsManager {
        queuedRefundRequestClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedRefundExecutedClaims(RefundExecutedClaim calldata _claim) external onlyClaimsManager {
        queuedRefundExecutedClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedBatchExecutionFailedClaims(BatchExecutionFailedClaim calldata _claim) external onlyClaimsManager {
        queuedBatchExecutionFailedClaims[_claim.observedTransactionHash] = _claim;
    }

    //TODO: think about constraint for setting this value
    function setClaimsManager(address _claimsManager) external {
        claimsManager = ClaimsManager(_claimsManager);
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
       if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }

    
}