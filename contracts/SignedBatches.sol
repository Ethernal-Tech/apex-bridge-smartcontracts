// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeStructs.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract SignedBatches is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    // hash -> multisig / bls signatures
    mapping(bytes32 => bytes[]) private signatures;

    // hash -> fee signatures
    mapping(bytes32 => bytes[]) private feeSignatures;

    // hash -> bls bitmap
    mapping(bytes32 => uint256) private bitmap;

    // hash -> user address -> true/false
    mapping(bytes32 => mapping(address => bool)) public hasVoted; // for resubmit

    // BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastConfirmedBatch;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin) public initializer {
        _transferOwnership(_owner);
        upgradeAdmin = _upgradeAdmin;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

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

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
