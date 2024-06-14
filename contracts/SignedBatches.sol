// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeStructs.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract SignedBatches is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    // hash -> multisigSignatures
    mapping(bytes32 => bytes[]) private multisigSignatures;

    // hash -> multisigSignatures
    mapping(bytes32 => bytes[]) private feePayerMultisigSignatures;

    // hash -> user address -> true/false
    mapping(bytes32 => mapping(address => bool)) private hasVoted; // for resubmit

    // BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) public lastConfirmedBatch;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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
            abi.encode(
                SignedBatchWithoutSignatures(
                    _signedBatch.id,
                    _signedBatch.firstTxNonceId,
                    _signedBatch.lastTxNonceId,
                    _destinationChainId,
                    _signedBatch.rawTransaction,
                    _signedBatch.usedUTXOs
                )
            )
        );

        // check if caller already voted for same hash
        if (hasVoted[_sbHash][_caller]) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = multisigSignatures[_sbHash].length;

        // check if consensus is already reached for this batch
        if (_numberOfVotes >= _quorumCount) {
            return;
        }

        hasVoted[_sbHash][_caller] = true;
        multisigSignatures[_sbHash].push(_signedBatch.multisigSignature);
        feePayerMultisigSignatures[_sbHash].push(_signedBatch.feePayerMultisigSignature);

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                multisigSignatures[_sbHash],
                feePayerMultisigSignatures[_sbHash],
                _signedBatch.rawTransaction,
                _sbId
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);
        }
    }

    function getConfirmedBatch(uint8 _destinationChain) external view returns (ConfirmedBatch memory _batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
