// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeStructs.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";
import "./Admin.sol";

contract SignedBatches is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;
    address private adminContractAddress;

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

    // claimHash for pruning
    ClaimHash[] public signedBatchesHashes;
    uint256 public constant MIN_CLAIM_BLOCK_AGE = 100; //TODO SET THIS VALUE TO AGREED ON

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress,
        address _adminContractAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
        adminContractAddress = _adminContractAddress;
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
                _signedBatch.rawTransaction
            )
        );

        // check if caller already voted for same hash
        if (hasVoted[_sbHash][_caller]) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = signatures[_sbHash].length;

        if (_numberOfVotes == 0) {
            signedBatchesHashes.push(ClaimHash(_sbHash, block.number));
        }

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
                _sbId
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);
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

    function pruneSignedBatches(
        uint256 _quorumCount,
        address[] calldata _validators,
        uint256 _deleteToBlock
    ) external onlyAdminContract {
        uint256 i = 0;
        while (i < signedBatchesHashes.length) {
            bytes32 _hashValue = signedBatchesHashes[i].hashValue;
            if (
                signatures[_hashValue].length >= _quorumCount ||
                block.number - signedBatchesHashes[i].blockNumber >= _deleteToBlock
            ) {
                for (uint256 j = 0; j < _validators.length; j++) {
                    delete hasVoted[_hashValue][_validators[j]];
                }
                delete signatures[_hashValue];
                delete feeSignatures[_hashValue];
                delete bitmap[_hashValue];
                signedBatchesHashes[i] = signedBatchesHashes[signedBatchesHashes.length - 1];
                signedBatchesHashes.pop();
            } else {
                i++;
            }
        }
    }

    function getSignedBatchesHashes() external view returns (ClaimHash[] memory) {
        return signedBatchesHashes;
    }

    function getSignatures(bytes32 _hash) external view returns (bytes[] memory) {
        return signatures[_hash];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyAdminContract() {
        if (msg.sender != adminContractAddress) revert NotClaims();
        _;
    }
}
