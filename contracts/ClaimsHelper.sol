// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract ClaimsHelper is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin) public initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        _transferOwnership(_owner);
        upgradeAdmin = _upgradeAdmin;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(address _claimsAddress, address _signedBatchesAddress) external onlyOwner {
        if (!_isContract(_claimsAddress) || !_isContract(_signedBatchesAddress)) revert NotContractAddress();
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
            _signedBatch.lastTxNonceId,
            _signedBatch.isConsolidation
        );
        currentBatchBlock[destinationChainId] = int256(block.number);
    }

    // update vote only if _hash is not already confiremed or _voter not already voted
    function setVotedOnlyIfNeeded(
        address _voter,
        bytes32 _hash,
        uint256 _quorumCnt
    ) external onlySignedBatchesOrClaims returns (bool) {
        if (isVoteRestricted(_voter, _hash, _quorumCnt)) {
            return false;
        }

        hasVoted[_hash][_voter] = true;
        return ++numberOfVotes[_hash] >= _quorumCnt;
    }

    function isVoteRestricted(address _voter, bytes32 _hash, uint256 _quorumCnt) public view returns (bool) {
        return hasVoted[_hash][_voter] || numberOfVotes[_hash] >= _quorumCnt;
    }

    function setVoted(address _voter, bytes32 _hash) external onlySignedBatchesOrClaims returns (uint256) {
        hasVoted[_hash][_voter] = true;
        uint256 v = ++numberOfVotes[_hash]; // v is numberOfVotes[_hash] + 1
        return v;
    }

    function deleteConfirmedSignedBatch(uint8 chainId, uint64 batchId) external onlyClaims {
        confirmedSignedBatches[chainId][batchId] = ConfirmedSignedBatchData(0, 0, false);
    }

    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
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

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
