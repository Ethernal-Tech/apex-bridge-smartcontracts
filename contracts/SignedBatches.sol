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

    // BlockchanID -> hash -> multisigSignatures
    mapping(string => mapping(bytes32 => string[])) private multisigSignatures;

    // BlockchanID -> hash -> multisigSignatures
    mapping(string => mapping(bytes32 => string[])) private feePayerMultisigSignatures;

    mapping(string => mapping(bytes32 => mapping(address => bool))) private hasVoted; // for resubmit

    // BlockchainID -> ConfirmedBatch
    mapping(string => ConfirmedBatch) public lastConfirmedBatch;

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
        string calldata _destinationChainId = _signedBatch.destinationChainId;
        uint256 _sbId = lastConfirmedBatch[_destinationChainId].id + 1;

        if (_signedBatch.id != _sbId) {
            return; // skip if this is not batch we are expecting
        }

        bytes32 _sbHash = keccak256(
            abi.encode(
                SignedBatchWithoutSignatures(
                    _signedBatch.id,
                    _destinationChainId,
                    _signedBatch.rawTransaction,
                    _signedBatch.firstTxNonceId,
                    _signedBatch.lastTxNonceId,
                    _signedBatch.usedUTXOs
                )
            )
        );

        // check if caller already voted for same hash
        if (hasVoted[_destinationChainId][_sbHash][_caller]) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _numberOfVotes = multisigSignatures[_destinationChainId][_sbHash].length;

        // check if consensus is already reached for this batch
        if (_numberOfVotes >= _quorumCount) {
            return;
        }

        hasVoted[_destinationChainId][_sbHash][_caller] = true;
        multisigSignatures[_destinationChainId][_sbHash].push(_signedBatch.multisigSignature);
        feePayerMultisigSignatures[_destinationChainId][_sbHash].push(_signedBatch.feePayerMultisigSignature);

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                _sbId,
                _signedBatch.rawTransaction,
                multisigSignatures[_destinationChainId][_sbHash],
                feePayerMultisigSignatures[_destinationChainId][_sbHash]
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);
        }
    }

    function getConfirmedBatch(string calldata _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
