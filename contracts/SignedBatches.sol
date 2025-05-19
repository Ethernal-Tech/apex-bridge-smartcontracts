// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

// @title SignedBatches
/// @notice Handles submission and confirmation of signed transaction batches for a cross-chain bridge.
/// @dev Utilizes OpenZeppelin upgradeable contracts and interacts with ClaimsHelper and Validators for consensus logic.
contract SignedBatches is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    /// @notice Maps batch hash to validator signatures.
    /// @dev hash -> multisig / bls signatures
    mapping(bytes32 => bytes[]) private signatures;

    /// @notice Maps batch hash to fee signatures.
    /// @dev hash -> fee signatures
    mapping(bytes32 => bytes[]) private feeSignatures;

    /// @notice Maps batch hash to BLS validator bitmap.
    /// @dev hash -> bls bitmap
    mapping(bytes32 => uint256) private bitmap;

    /// @notice Tracks if an address has voted for a specific batch hash
    /// @dev hash -> user address -> true/false
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

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
        if (_owner == address(0)) revert ZeroAddress();
        _transferOwnership(_owner);
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
                _signedBatch.isConsolidation
            )
        );

        // check if caller already voted for same hash and skip if he did
        if (hasVoted[_sbHash][_caller]) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = signatures[_sbHash].length;
        uint8 validatorIdx = validators.getValidatorIndex(_caller) - 1;

        hasVoted[_sbHash][_caller] = true;

        signatures[_sbHash].push(_signedBatch.signature);
        feeSignatures[_sbHash].push(_signedBatch.feeSignature);
        unchecked {
            bitmap[_sbHash] = bitmap[_sbHash] | (1 << validatorIdx);
        }

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                signatures[_sbHash],
                feeSignatures[_sbHash],
                bitmap[_sbHash],
                _signedBatch.rawTransaction,
                _sbId,
                _signedBatch.isConsolidation
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);

            delete signatures[_sbHash];
            delete feeSignatures[_sbHash];
            delete bitmap[_sbHash];
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

    function getNumberOfSignatures(bytes32 _hash) external view returns (uint256, uint256) {
        return (signatures[_hash].length, feeSignatures[_hash].length);
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
