// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeStructs.sol";
import "hardhat/console.sol";
import "./Slots.sol";

contract ClaimsHelper is IBridgeStructs {
    address private claimsAddress;
    address private signedBatchesAddress;
    address private owner;

    // blockchain -> claimHash -> queued
    mapping(string => mapping(string => bool)) public isClaimConfirmed;

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => SignedBatch)) public confirmedSignedBatches;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public hasVoted;

    // ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(address _claimsAddress, address _signedBatchesAddress) external onlyOwner {
        claimsAddress = _claimsAddress;
        signedBatchesAddress = _signedBatchesAddress;
    }

    function getConfirmedSignedBatch(
        string calldata _chainId,
        uint256 _batchId
    ) external view returns (SignedBatch memory) {
        return confirmedSignedBatches[_chainId][_batchId];
    }

    function setCurrentBatchBlock(string calldata _chainId, int value) external onlySignedBatches {
        currentBatchBlock[_chainId] = value;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyClaims {
        currentBatchBlock[_chainId] = int(-1);
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchesOrClaims {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function getNumberOfVotes(bytes32 _hash) external view returns (uint8) {
        return numberOfVotes[_hash];
    }

    function setConfirmedSignedBatches(SignedBatch calldata _signedBatch) external onlySignedBatchesOrClaims {
        confirmedSignedBatches[_signedBatch.destinationChainId][_signedBatch.id] = _signedBatch;
    }

    function setVoted(string calldata _id, address _voter, bytes32 _hash) external onlySignedBatchesOrClaims {
        hasVoted[_id][_voter] = true;
        numberOfVotes[_hash]++;
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

    modifier onlySignedBatchesOrClaims() {
        if (msg.sender != signedBatchesAddress && msg.sender != claimsAddress) revert NotSignedBatchesOrBridge();
        _;
    }

    modifier onlySignedBatches() {
        if (msg.sender != signedBatchesAddress) revert NotSignedBatches();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsAddress) revert NotClaims();
        _;
    }
}
