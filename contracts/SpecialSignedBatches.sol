// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/ConstantsLib.sol";
import "./Utils.sol";
import "./Bridge.sol";
import "./ClaimsHelper.sol";
import "./SignedBatches.sol";
import "./Validators.sol";

/// @title Claims
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract SpecialSignedBatches is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using ConstantsLib for uint8;

    address private upgradeAdmin;
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    SignedBatches private signedBatches;
    Validators private validators;

    /// @notice Stores the last special confirmed batch per destination chain
    /// @dev BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastSpecialConfirmedBatch;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters.
    /// @param _owner Address to be set as contract owner.
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
    /// @param _bridgeAddress Address of the Bridge contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _signedBatchesAddress Address of the SignedBatches contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _signedBatchesAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_signedBatchesAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Submits a special signed batch for updating validator set.
    /// @dev This function checks batch sequencing, validates votes, and finalizes the batch if quorum is met.
    /// @param _signedBatch The signed batch containing transaction details and validator signatures.
    /// @param _caller The address of the validator submitting the batch.
    /// Requirements:
    /// - Caller must be the bridge contract.
    /// - The batch must have the expected sequential ID.
    /// - The caller must not have already voted on this batch hash.
    /// - If quorum is reached after this vote, the batch is confirmed and stored, and temporary data is cleared.
    function submitSpecialSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridge {
        uint8 _destinationChainId = _signedBatch.destinationChainId;

        uint64 _sbId = lastSpecialConfirmedBatch[_destinationChainId].id + 1;

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
                _signedBatch.isConsolidation
            )
        );

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint256 _bitmapValue = signedBatches.bitmap(_sbHash);
        uint256 _bitmapNewValue;
        unchecked {
            _bitmapNewValue = _bitmapValue | (1 << _validatorIdx);
        }

        // check if caller already voted for same hash and skip if he did
        if (_bitmapValue == _bitmapNewValue) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        (uint256 _numberOfVotes, ) = signedBatches.getNumberOfSignatures(_sbHash);

        signedBatches.addSignature(_sbHash, _signedBatch.signature);
        signedBatches.addFeeSignature(_sbHash, _signedBatch.feeSignature);
        signedBatches.setBitmap(_sbHash, _bitmapNewValue);

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastSpecialConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                signedBatches.getSignatures(_sbHash),
                signedBatches.getFeeSignatures(_sbHash),
                signedBatches.bitmap(_sbHash),
                _signedBatch.rawTransaction,
                _sbId,
                _signedBatch.isConsolidation
            );

            claimsHelper.setSpecialConfirmedSignedBatchData(_signedBatch);

            signedBatches.deleteSignaturesFeeSignaturesBitmap(_sbHash);
        }
    }

    function getSpecialConfirmedBatch(uint8 _destinationChain) external view returns (ConfirmedBatch memory _batch) {
        return lastSpecialConfirmedBatch[_destinationChain];
    }

    function getSpecialConfirmedBatchId(uint8 _destinationChain) external view returns (uint64) {
        return lastSpecialConfirmedBatch[_destinationChain].id;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
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
