// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeContractStructs.sol";

contract ClaimsHelper is IBridgeContractStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private claimsManagerAddress;
    address private signedBatchManagerAddress;

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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

    function getNumberOfVotes(bytes32 _hash) external view returns (uint8) {
        return numberOfVotes[_hash];
    }

    function setConfirmedSignedBatches(
        SignedBatch calldata _signedBatch
    ) external onlySignedBatchManagerOrClaimsManager {
        confirmedSignedBatches[_signedBatch.destinationChainId][_signedBatch.id] = _signedBatch;
    }

    function setVoted(
        string calldata _id,
        address _voter,
        bytes32 _hash
    ) external onlySignedBatchManagerOrClaimsManager {
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
