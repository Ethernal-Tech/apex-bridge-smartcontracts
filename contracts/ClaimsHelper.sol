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

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => SignedBatch)) public confirmedSignedBatches;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(address _claimsManagerAddress, address _signedBatchManagerAddress) external onlyOwner {
        claimsManagerAddress = _claimsManagerAddress;
        signedBatchManagerAddress = _signedBatchManagerAddress;
    }

    function getConfirmedSignedBatch(
        string calldata _chainId,
        uint256 _batchId
    ) external view returns (SignedBatch memory) {
        return confirmedSignedBatches[_chainId][_batchId];
    }

    function setCurrentBatchBlock(string calldata _chainId, int value) external onlySignedBatchManager {
        currentBatchBlock[_chainId] = value;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyClaimsManager {
        currentBatchBlock[_chainId] = int(-1);
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchManagerOrClaimsManager {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function setConfirmedSignedBatches(
        SignedBatch calldata _signedBatch
    ) external onlySignedBatchManagerOrClaimsManager {
        confirmedSignedBatches[_signedBatch.destinationChainId][_signedBatch.id] = _signedBatch;
    }

    function setVoted(string calldata _id, address _voter, bool _value) external onlySignedBatchManagerOrClaimsManager {
        voted[_id][_voter] = _value;
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

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySignedBatchManagerOrClaimsManager() {
        if (msg.sender != signedBatchManagerAddress && msg.sender != claimsManagerAddress)
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }

    modifier onlySignedBatchManager() {
        if (msg.sender != signedBatchManagerAddress) revert NotSignedBatchManager();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != claimsManagerAddress) revert NotClaimsManager();
        _;
    }
}
