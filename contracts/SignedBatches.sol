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
    uint256 private constant MaxHashesPerChain = 64;

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

    /// @notice Stores the last confirmed batch per destination chain
    /// @dev BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastConfirmedBatch;

    /// @notice Stores the used hashes per destination chain
    /// @dev BlockchainId -> list of hashes
    mapping(uint8 => bytes32[]) private usedHashesPerChain;

    /// @notice Tracks the starting index of the circular buffer for each destination chain.
    /// @dev Mapping from destination chain ID to the index of the next position to overwrite
    ///      in the `usedHashesPerChain` buffer.
    mapping(uint8 => uint16) private usedHashesStartIndexPerChain;

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
                _signedBatch.isConsolidation
            )
        );

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint256 _bitmapValue = bitmap[_sbHash];
        uint256 _bitmapNewValue;
        unchecked {
            _bitmapNewValue = _bitmapValue | (1 << _validatorIdx);
        }

        // check if caller already voted for same hash and skip if he did
        if (_bitmapValue == _bitmapNewValue) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = signatures[_sbHash].length;

        signatures[_sbHash].push(_signedBatch.signature);
        feeSignatures[_sbHash].push(_signedBatch.feeSignature);
        bitmap[_sbHash] = _bitmapNewValue;

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
            // clear temporary data
            bytes32[] storage _usedHashes = usedHashesPerChain[_destinationChainId];
            uint256 _usedHashesLength = _usedHashes.length;
            for (uint256 i = 0; i < _usedHashesLength; ) {
                bytes32 _hash = _usedHashes[i];
                delete signatures[_hash];
                delete feeSignatures[_hash];
                delete bitmap[_hash];
                unchecked {
                    ++i;
                } // Saves 100 gas per iteration
            }

            delete usedHashesPerChain[_destinationChainId];
            delete usedHashesStartIndexPerChain[_destinationChainId];
        } else if (_numberOfVotes == 0) {
            bytes32[] storage _usedHashes = usedHashesPerChain[_destinationChainId];
            // if this is the first vote for this hash, we need to store it
            // but we need to limit the number of hashes per chain
            if (_usedHashes.length == MaxHashesPerChain) {
                uint16 oldIndex = usedHashesStartIndexPerChain[_destinationChainId];
                bytes32 _hash = _usedHashes[oldIndex];
                // delete old hash
                delete signatures[_hash];
                delete feeSignatures[_hash];
                delete bitmap[_hash];
                // update new values
                usedHashesStartIndexPerChain[_destinationChainId] = (oldIndex + 1) % uint16(MaxHashesPerChain);
                _usedHashes[oldIndex] = _sbHash;
            } else {
                _usedHashes.push(_sbHash);
            }
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

    function hasVoted(bytes32 _hash, address _addr) external view returns (bool) {
        uint8 _validatorIdx = validators.getValidatorIndex(_addr);
        if (_validatorIdx == 0) {
            return false; // address is not a validator
        }
        return bitmap[_hash] & (1 << (_validatorIdx - 1)) != 0;
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
