// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "hardhat/console.sol";
import "./SlotsManager.sol";

contract ClaimsHelper is IBridgeContractStructs {
    address private claimsManagerAddress;
    address private signedBatchManagerAddress;
    address private owner;

    // blockchain -> claimHash -> queued
    mapping(string => mapping(string => bool)) public isClaimConfirmed;

    // claimHash -> claim
    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;
    mapping(string => BatchExecutedClaim) public queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) public queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) public queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) public queuedRefundExecutedClaims;

    constructor(address _signedBatchManagerAddress) {
        owner = msg.sender;
        signedBatchManagerAddress = _signedBatchManagerAddress;
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

    function addToQueuedBatchExecutionFailedClaims(
        BatchExecutionFailedClaim calldata _claim
    ) external onlyClaimsManager {
        queuedBatchExecutionFailedClaims[_claim.observedTransactionHash] = _claim;
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchManagerOrClaimsManager {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function _equal(string memory a, string memory b) internal pure returns (bool) {
        return bytes(a).length == bytes(b).length && keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _equalReveivers(Receiver[] memory a, Receiver[] memory b) internal pure returns (bool) {
        if (a.length != b.length) {
            return false;
        }

        for (uint256 i = 0; i < a.length; i++) {
            if (a[i].amount != b[i].amount || !_equal(a[i].destinationAddress, b[i].destinationAddress)) {
                return false;
            }
        }

        return true;
    }

    function setClaimsManager(address _claimsManagerAddress) external onlyOwner {
        claimsManagerAddress = _claimsManagerAddress;
    }
    
    modifier onlyClaimsManager() {
        if (msg.sender != address(claimsManagerAddress)) revert NotClaimsManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != address(owner)) revert NotOwner();
        _;
    }

    modifier onlySignedBatchManagerOrClaimsManager() {
        if (msg.sender != address(signedBatchManagerAddress) && msg.sender != address(claimsManagerAddress))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
