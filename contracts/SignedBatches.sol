// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/BatchTypesLib.sol";
import "./Utils.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

// @title SignedBatches
/// @notice Handles submission and confirmation of signed transaction batches for a cross-chain bridge.
/// @dev Utilizes OpenZeppelin upgradeable contracts and interacts with ClaimsHelper and Validators for consensus logic.
contract SignedBatches is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using BatchTypesLib for uint8;

    address private upgradeAdmin;
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    /// @notice Maps batch hash to validator votes information
    /// @dev hash -> SignedBatchVotesInfo represent signatures (bls | multisig+fee) and bitmap
    mapping(bytes32 => SignedBatchVotesInfo) private votes;

    /// @notice Stores the last confirmed batch per destination chain
    /// @dev BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastConfirmedBatch;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract.
    /// @param _owner Address to be set as the owner.
    /// @param _upgradeAdmin Address allowed to upgrade the contract.
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
    /// @param _bridgeAddress Address of the bridge contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (!_isContract(_bridgeAddress) || !_isContract(_claimsHelperAddress) || !_isContract(_validatorsAddress))
            revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Submits a signed batch for validation and potential confirmation.
    /// @dev This function checks batch sequencing, validates votes, and finalizes the batch if quorum is met.
    /// @param _signedBatch The signed batch containing transaction details and validator signatures.
    /// @param _caller The address of the validator submitting the batch.
    /// Requirements:
    /// - Caller must be the bridge contract.
    /// - The batch must have the expected sequential ID.
    /// - The caller must not have already voted on this batch hash.
    /// - If quorum is reached after this vote, the batch is confirmed and stored, and temporary data is cleared.
    function submitSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridge {
        uint8 _destinationChainId = _signedBatch.destinationChainId;
        uint64 _sbId = lastConfirmedBatch[_destinationChainId].id + 1;

        if (_signedBatch.id != _sbId) {
            return; // skip if this is not batch we are expecting
        }

        bytes32 _sbHash = keccak256(
            abi.encodePacked(
                _signedBatch.id,
                _signedBatch.firstTxNonceId,
                _signedBatch.lastTxNonceId,
                _destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.batchType
            )
        );

        SignedBatchVotesInfo storage _votesInfo = votes[_sbHash];
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint256 _bitmapValue = _votesInfo.bitmap;
        uint256 _bitmapNewValue;
        unchecked {
            _bitmapNewValue = _bitmapValue | (1 << _validatorIdx);
        }

        // check if caller already voted for same hash and skip if he did
        if (_bitmapValue == _bitmapNewValue) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = _votesInfo.signatures.length;

        _votesInfo.signatures.push(_signedBatch.signature);
        _votesInfo.feeSignatures.push(_signedBatch.feeSignature);
        _votesInfo.stakeSignatures.push(_signedBatch.stakeSignature);
        _votesInfo.bitmap = _bitmapNewValue;

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                _votesInfo.signatures,
                _votesInfo.feeSignatures,
                _votesInfo.bitmap,
                _signedBatch.rawTransaction,
                _sbId,
                _signedBatch.batchType,
                _votesInfo.stakeSignatures
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);

            delete votes[_sbHash];
        }
    }

    function getConfirmedBatch(uint8 _destinationChain) external view returns (ConfirmedBatch memory _batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    function getConfirmedBatchId(uint8 _destinationChain) external view returns (uint64) {
        return lastConfirmedBatch[_destinationChain].id;
    }

    function getConfirmedBatchTransaction(uint8 _destinationChain) external view returns (bytes memory) {
        return lastConfirmedBatch[_destinationChain].rawTransaction;
    }

    function getNumberOfSignatures(bytes32 _hash) external view returns (uint256) {
        return votes[_hash].signatures.length;
    }

    function hasVoted(bytes32 _hash, address _addr) external view returns (bool) {
        uint8 _validatorIdx = validators.getValidatorIndex(_addr);
        if (_validatorIdx == 0) {
            return false; // address is not a validator
        }
        return votes[_hash].bitmap & (1 << (_validatorIdx - 1)) != 0;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.1.0";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
