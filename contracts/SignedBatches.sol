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

    // BlockchanId -> hash -> multisigSignatures
    mapping(uint8 => mapping(bytes32 => string[])) private multisigSignatures;

    // BlockchanId -> hash -> multisigSignatures
    mapping(uint8 => mapping(bytes32 => string[])) private feePayerMultisigSignatures;

    // BlockchainId -> ConfirmedBatch
    mapping(uint256 => ConfirmedBatch) public lastConfirmedBatch;

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
        bytes32 _batchIdBytes = bytes32(_signedBatch.id);

        uint256 sbId = lastConfirmedBatch[_destinationChainId].id;

        if (_signedBatch.id != sbId + 1) {
            return; // do not revert! batcher can lag a little bit. revert WrongBatchNonce(_destinationChainId, _signedBatch.id);
        }

        if (claimsHelper.hasVoted(_batchIdBytes, _caller)) {
            return;
        }

        if (claimsHelper.isClaimConfirmed(_destinationChainId, _batchIdBytes)) {
            return;
        }

        _submitSignedBatch(_signedBatch, _signedBatch.id);
    }

    function _submitSignedBatch(SignedBatch calldata _signedBatch, uint256 _batchId) internal {
        SignedBatchWithoutSignatures memory _signedBatchWithoutSignatures = SignedBatchWithoutSignatures(
            _signedBatch.id,
            _signedBatch.destinationChainId,
            _signedBatch.rawTransaction,
            _signedBatch.firstTxNonceId,
            _signedBatch.lastTxNonceId,
            _signedBatch.usedUTXOs
        );
        bytes32 signedBatchHash = keccak256(abi.encode(_signedBatchWithoutSignatures));

        multisigSignatures[_signedBatch.destinationChainId][signedBatchHash].push(_signedBatch.multisigSignature);
        feePayerMultisigSignatures[_signedBatch.destinationChainId][signedBatchHash].push(
            _signedBatch.feePayerMultisigSignature
        );

        uint256 votesCount = claimsHelper.setVoted(bytes32(_batchId), msg.sender, signedBatchHash);

        if (votesCount >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setConfirmedSignedBatchData(_signedBatch);

            claimsHelper.setClaimConfirmed(_signedBatch.destinationChainId, bytes32(_batchId));

            lastConfirmedBatch[_signedBatch.destinationChainId] = ConfirmedBatch(
                lastConfirmedBatch[_signedBatch.destinationChainId].id + 1,
                _signedBatch.rawTransaction,
                multisigSignatures[_signedBatch.destinationChainId][signedBatchHash],
                feePayerMultisigSignatures[_signedBatch.destinationChainId][signedBatchHash]
            );

            claimsHelper.updateCurrentBatchBlock(_signedBatch.destinationChainId);
        }
    }

    function isBatchAlreadySubmittedBy(uint8 _destinationChain, address _addr) public view returns (bool ok) {
        return claimsHelper.hasVoted(bytes32(lastConfirmedBatch[_destinationChain].id + 1), _addr);
    }

    function getConfirmedBatch(uint8 _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
