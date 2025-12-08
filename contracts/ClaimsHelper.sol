// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/ConstantsLib.sol";
import "./Utils.sol";

/// @title ClaimsHelper
/// @notice Handles claim voting, signed batch confirmations, and upgradeable logic for a cross-chain bridge.
/// @dev This contract is upgradeable using OpenZeppelin's UUPS pattern.
contract ClaimsHelper is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using ConstantsLib for uint8;

    address private upgradeAdmin;
    address private claimsAddress;
    address private signedBatchesAddress;

    /// @notice Mapping of confirmed signed batches
    /// @dev BlockchainId -> batchId -> SignedBatch
    mapping(uint8 => mapping(uint64 => ConfirmedSignedBatchData)) public confirmedSignedBatches;

    /// @notice Mapping of current batch block numbers per chain.
    /// @dev BlochchainId -> blockNumber
    mapping(uint8 => int256) public currentBatchBlock;

    /// @notice Mapping from (chain ID, block hash, slot) hash to bitmap contains all validator votes.
    /// @dev hash(slot, hash) -> bitmap
    mapping(bytes32 => uint256) public bitmap;

    address private claimsProcessorAddress;
    address private registrationAddress;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[48] private __gap;

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

    function setAdditionalDependenciesAndSync(
        address _claimsProcessorAddress,
        address _registrationAddress
    ) external onlyUpgradeAdmin {
        if (!_isContract(_claimsProcessorAddress) || !_isContract(_registrationAddress)) revert NotContractAddress();
        claimsProcessorAddress = _claimsProcessorAddress;
        registrationAddress = _registrationAddress;
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
    function resetCurrentBatchBlock(uint8 _chainId) external onlyClaimsOrClaimsProcessor {
        currentBatchBlock[_chainId] = int256(-1);
    }

    /// @notice Update number of votes for specific hash if needed and returns true if update was executed
    /// @dev Update number of votes for specific hash if needed and returns true if update was executed
    /// @param _hash hash
    /// @param _validatorIdx index of validator
    function updateVote(bytes32 _hash, uint8 _validatorIdx) external onlyClaimsProcessorOrRegistration returns (bool) {
        uint256 _bitmapValue = bitmap[_hash];
        uint256 _newBitmapValue = _bitmapValue | (1 << _validatorIdx);

        if (_newBitmapValue == _bitmapValue) {
            return false;
        }

        bitmap[_hash] = _newBitmapValue;

        return true;
    }

    /// @notice Stores a confirmed signed batch for a specific destination chain and batch ID.
    /// @dev Updates both `confirmedSignedBatches` and `currentBatchBlock` mappings.
    /// @param _signedBatch The signed batch data containing metadata and transaction nonce range.
    function setConfirmedSignedBatchData(SignedBatch calldata _signedBatch) external onlySignedBatches {
        uint8 destinationChainId = _signedBatch.destinationChainId;
        uint64 signedBatchId = _signedBatch.id;

        confirmedSignedBatches[destinationChainId][signedBatchId] = ConfirmedSignedBatchData(
            _signedBatch.firstTxNonceId,
            _signedBatch.lastTxNonceId,
            false, // deprecated field
            ConstantsLib.IN_PROGRESS, // status 1 means "in progress"
            _signedBatch.batchType
        );

        currentBatchBlock[destinationChainId] = int256(block.number);
    }

    function hasVoted(bytes32 _hash, uint8 _validatorIndex) external view returns (bool) {
        uint256 _bitmapValue = bitmap[_hash];
        return (_bitmapValue & (1 << _validatorIndex)) != 0;
    }

    function numberOfVotes(bytes32 _hash) external view returns (uint8) {
        uint8 _votesNum;
        uint256 _bitmapValue = bitmap[_hash];

        // Brian Kernighan's algorithm
        // @see https://github.com/estarriolvetch/solidity-bits/blob/main/contracts/Popcount.sol
        unchecked {
            for (_votesNum = 0; _bitmapValue != 0; _votesNum++) {
                _bitmapValue &= _bitmapValue - 1;
            }
        }

        return _votesNum;
    }

    /// @notice Sets the specified batch entry to a final status.
    /// @dev Sets the specified batch entry to a final status.
    /// @param _chainId The ID of the blockchain where the batch resides.
    /// @param _batchId The unique identifier of the batch to delete.
    /// @param _status The new status to set for the batch.
    function setConfirmedSignedBatchStatus(
        uint8 _chainId,
        uint64 _batchId,
        uint8 _status
    ) external onlyClaimsProcessor {
        confirmedSignedBatches[_chainId][_batchId].status = _status;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.2.1";
    }

    modifier onlySignedBatches() {
        if (msg.sender != signedBatchesAddress) revert NotSignedBatches();
        _;
    }

    modifier onlyClaimsProcessor() {
        if (msg.sender != claimsProcessorAddress) revert NotClaimsProcessor();
        _;
    }

    modifier onlyClaimsOrClaimsProcessor() {
        if (msg.sender != claimsAddress && msg.sender != claimsProcessorAddress) revert NotClaimsOrClaimsProcessor();
        _;
    }

    modifier onlyClaimsProcessorOrRegistration() {
        if (msg.sender != claimsProcessorAddress && msg.sender != registrationAddress)
            revert NotClaimsProcessorOrRegistration();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }
}
