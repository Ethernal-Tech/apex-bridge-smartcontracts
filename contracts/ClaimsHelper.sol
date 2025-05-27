// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

/// @title ClaimsHelper
/// @notice Handles claim voting, signed batch confirmations, and upgradeable logic for a cross-chain bridge.
/// @dev This contract is upgradeable using OpenZeppelin's UUPS pattern.
contract ClaimsHelper is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private claimsAddress;
    address private signedBatchesAddress;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @notice Mapping of confirmed signed batches
    /// @dev BlockchainId -> batchId -> SignedBatch
    mapping(uint8 => mapping(uint64 => ConfirmedSignedBatchData)) public confirmedSignedBatches;

    /// @notice Mapping of current batch block numbers per chain.
    /// @dev BlochchainId -> blockNumber
    mapping(uint8 => int256) public currentBatchBlock;

    /// @notice Tracks whether a voter has voted on a specific transaction hash
    /// @dev TansactionHash -> Voter -> Voted
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    /// @notice Number of votes for a given claim hash.
    /// @dev ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract.
    /// @param _owner The address to be set as the contract owner.
    /// @param _upgradeAdmin The address authorized to perform upgrades.
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _claimsAddress Address of the Claims contract.
    /// @param _signedBatchesAddress Address of the SignedBatches contract.
    function setDependencies(address _claimsAddress, address _signedBatchesAddress) external onlyOwner {
        if (!_isContract(_claimsAddress) || !_isContract(_signedBatchesAddress)) revert NotContractAddress();
        claimsAddress = _claimsAddress;
        signedBatchesAddress = _signedBatchesAddress;
    }

    /// @notice Retrieves confirmed signed batch data.
    /// @param _chainId The ID of the destination chain.
    /// @param _batchId The batch ID.
    /// @return _confirmedSignedBatchData The batch data.
    function getConfirmedSignedBatchData(
        uint8 _chainId,
        uint64 _batchId
    ) external view returns (ConfirmedSignedBatchData memory _confirmedSignedBatchData) {
        return confirmedSignedBatches[_chainId][_batchId];
    }

    /// @notice Resets the current batch block for a given chain.
    /// @param _chainId The ID of the chain.
    function resetCurrentBatchBlock(uint8 _chainId) external onlyClaims {
        currentBatchBlock[_chainId] = int256(-1);
    }

    /// @notice Stores a confirmed signed batch for a specific destination chain and batch ID.
    /// @dev Updates both `confirmedSignedBatches` and `currentBatchBlock` mappings.
    /// @param _signedBatch The signed batch data containing metadata and transaction nonce range.
    function setConfirmedSignedBatchData(SignedBatch calldata _signedBatch) external onlySignedBatchesOrClaims {
        uint8 destinationChainId = _signedBatch.destinationChainId;
        uint64 signedBatchId = _signedBatch.id;

        confirmedSignedBatches[destinationChainId][signedBatchId] = ConfirmedSignedBatchData(
            _signedBatch.firstTxNonceId,
            _signedBatch.lastTxNonceId,
            _signedBatch.isConsolidation,
            1 // status 1 means "in progress"
        );
        currentBatchBlock[destinationChainId] = int256(block.number);
    }

    /// @notice Registers a vote for a specific claim hash only if the voter hasn't already voted and quorum hasn't been reached.
    /// @dev Increments the vote count if conditions are met and returns whether the quorum is now reached.
    /// @param _voter The address of the voter attempting to vote.
    /// @param _hash The unique hash representing the claim being voted on.
    /// @param _quorumCnt The number of votes required to reach quorum.
    /// @return True if quorum has been reached after this vote; false otherwise.
    function setVotedOnlyIfNeeded(
        address _voter,
        bytes32 _hash,
        uint256 _quorumCnt
    ) external onlySignedBatchesOrClaims returns (bool) {
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (hasVoted[_hash][_voter] || numberOfVotes[_hash] >= _quorumCnt) {
            return false;
        }

        hasVoted[_hash][_voter] = true;
        return ++numberOfVotes[_hash] >= _quorumCnt;
    }

    /// @notice Registers a vote for a specific claim hash from a given voter.
    /// @dev Increments the vote count for the provided claim hash without checking for duplicates.
    /// @param _voter The address of the voter casting the vote.
    /// @param _hash The unique hash representing the claim being voted on.
    /// @return The updated number of votes for the given claim hash.
    function setVoted(address _voter, bytes32 _hash) external onlySignedBatchesOrClaims returns (uint256) {
        hasVoted[_hash][_voter] = true;
        uint256 v = ++numberOfVotes[_hash]; // v is numberOfVotes[_hash] + 1
        return v;
    }

    /// @notice Sets the status of a confirmed signed batch to a state.
    /// @dev Sets the specified batch entry to a new status.
    /// @param chainId The ID of the blockchain where the batch resides.
    /// @param batchId The unique identifier of the batch to delete.
    /// @param status The new status to set for the batch.
    function setConfirmedSignedBatchStatus(uint8 chainId, uint64 batchId, uint8 status) external onlyClaims {
        confirmedSignedBatches[chainId][batchId].status = status;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
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
