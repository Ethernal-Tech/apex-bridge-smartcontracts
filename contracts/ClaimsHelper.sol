// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract ClaimsHelper is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private claimsAddress;
    address private signedBatchesAddress;

    // blockchain -> claimHash -> queued
    mapping(string => mapping(string => bool)) public isClaimConfirmed;

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => ConfirmedSignedBatchData)) public confirmedSignedBatches;

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

    function setDependencies(address _claimsAddress, address _signedBatchesAddress) external onlyOwner {
        claimsAddress = _claimsAddress;
        signedBatchesAddress = _signedBatchesAddress;
    }

    function getConfirmedSignedBatchData(
        string calldata _chainId,
        uint256 _batchId
    ) external view returns (ConfirmedSignedBatchData memory) {
        return confirmedSignedBatches[_chainId][_batchId];
    }

    function updateCurrentBatchBlock(string calldata _chainId) external onlySignedBatches {
        currentBatchBlock[_chainId] = int256(block.number);
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyClaims {
        currentBatchBlock[_chainId] = int256(-1);
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchesOrClaims {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function setConfirmedSignedBatchData(SignedBatch calldata _signedBatch) external onlySignedBatchesOrClaims {
        // because of UnimplementedFeatureError: Copying of type struct IBridgeStructs.UTXO memory[] memory to storage not yet supported.
        string calldata destinationChainId = _signedBatch.destinationChainId;
        uint256 signedBatchID = _signedBatch.id;

        confirmedSignedBatches[destinationChainId][signedBatchID].firstTxNonceId = _signedBatch.firstTxNonceId;
        confirmedSignedBatches[destinationChainId][signedBatchID].lastTxNonceId = _signedBatch.lastTxNonceId;
        confirmedSignedBatches[destinationChainId][signedBatchID].usedUTXOs = _signedBatch.usedUTXOs;
    }

    function setVoted(
        string calldata _id,
        address _voter,
        bytes32 _hash
    ) external onlySignedBatchesOrClaims returns (uint256) {
        hasVoted[_id][_voter] = true;
        uint256 v = ++numberOfVotes[_hash]; // v is numberOfVotes[_hash] + 1
        return v;
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
