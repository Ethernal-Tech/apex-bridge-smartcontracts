// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract ClaimsHelper is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private claimsAddress;
    address private signedBatchesAddress;

    // BlockchainId -> batchId -> SignedBatch
    mapping(uint8 => mapping(uint64 => ConfirmedSignedBatchData)) public confirmedSignedBatches;

    // BlochchainId -> blockNumber
    mapping(uint8 => int256) public currentBatchBlock;

    // TansactionHash -> Voter -> Voted
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    // ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    // claimHash for pruning
    ClaimHash[] public claimsHashes;
    mapping(uint8 => uint64) public nextUnprunedConfirmedSignedBatch;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _claimsAddress, address _signedBatchesAddress) external onlyOwner {
        claimsAddress = _claimsAddress;
        signedBatchesAddress = _signedBatchesAddress;
    }

    function getConfirmedSignedBatchData(
        uint8 _chainId,
        uint64 _batchId
    ) external view returns (ConfirmedSignedBatchData memory _confirmedSignedBatchData) {
        return confirmedSignedBatches[_chainId][_batchId];
    }

    function resetCurrentBatchBlock(uint8 _chainId) external onlyClaims {
        currentBatchBlock[_chainId] = int256(-1);
    }

    function setConfirmedSignedBatchData(SignedBatch calldata _signedBatch) external onlySignedBatchesOrClaims {
        uint8 destinationChainId = _signedBatch.destinationChainId;
        uint64 signedBatchId = _signedBatch.id;

        confirmedSignedBatches[destinationChainId][signedBatchId] = ConfirmedSignedBatchData(
            _signedBatch.firstTxNonceId,
            _signedBatch.lastTxNonceId
        );
        currentBatchBlock[destinationChainId] = int256(block.number);
    }

    // update vote only if _hash is not already confiremed or _voter not already voted
    function setVotedOnlyIfNeeded(
        address _voter,
        bytes32 _hash,
        uint256 _quorumCnt
    ) external onlySignedBatchesOrClaims returns (bool) {
        if (hasVoted[_hash][_voter] || numberOfVotes[_hash] >= _quorumCnt) {
            return false;
        }

        hasVoted[_hash][_voter] = true;
        if (numberOfVotes[_hash] == 0) {
            claimsHashes.push(ClaimHash(_hash, block.number));
        }

        return ++numberOfVotes[_hash] >= _quorumCnt;
    }

    function setVoted(address _voter, bytes32 _hash) external onlySignedBatchesOrClaims returns (uint256) {
        hasVoted[_hash][_voter] = true;
        uint256 v = ++numberOfVotes[_hash]; // v is numberOfVotes[_hash] + 1
        return v;
    }

    function pruneClaims(uint256 _quorumCount, address[] calldata _validators, uint256 _ttl) external onlyOwner {
        uint256 i = 0;
        while (i < claimsHashes.length) {
            bytes32 _hashValue = claimsHashes[i].hashValue;
            if (numberOfVotes[_hashValue] >= _quorumCount || block.number - claimsHashes[i].blockNumber >= _ttl) {
                for (uint256 j = 0; j < _validators.length; j++) {
                    delete hasVoted[_hashValue][_validators[j]];
                }
                delete numberOfVotes[claimsHashes[i].hashValue];
                claimsHashes[i] = claimsHashes[claimsHashes.length - 1];
                claimsHashes.pop();
            } else {
                i++;
            }
        }
    }

    function pruneConfirmedSignedBatches(uint8 _chainId, uint64 _batchId) external onlyOwner {
        if (_batchId <= nextUnprunedConfirmedSignedBatch[_chainId]) revert AlreadyPruned();

        for (uint64 i = nextUnprunedConfirmedSignedBatch[_chainId]; i <= _batchId; i++) {
            delete confirmedSignedBatches[_chainId][i];
        }
        nextUnprunedConfirmedSignedBatch[_chainId] = _batchId + 1;
    }

    function getClaimsHashes() external view returns (ClaimHash[] memory) {
        return claimsHashes;
    }

    modifier onlySignedBatchesOrClaims() {
        if (msg.sender != signedBatchesAddress && msg.sender != claimsAddress) revert NotSignedBatchesOrClaims();
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
