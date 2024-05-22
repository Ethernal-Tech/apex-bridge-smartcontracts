// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

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

        if (_signedBatch.id != lastConfirmedBatch[_destinationChainId].id + 1) {
            return; // do not revert! batcher can lag a little bit. revert WrongBatchNonce(_destinationChainId, _signedBatch.id);
        }

        //TODO: this will probably be removed in the next optimization iteration, keeping it so PR would say simple
        string memory _batchIdStr = Strings.toString(_signedBatch.id);

        if (claimsHelper.hasVoted(_batchIdStr, _caller)) {
            return;
        }

        SignedBatchWithoutSignatures memory _signedBatchWithoutSignatures = SignedBatchWithoutSignatures(
            _signedBatch.id,
            _signedBatch.destinationChainId,
            _signedBatch.rawTransaction,
            _signedBatch.firstTxNonceId,
            _signedBatch.lastTxNonceId,
            _signedBatch.usedUTXOs
        );
        bytes32 _signedBatchHash = keccak256(abi.encode(_signedBatchWithoutSignatures));

        //TODO: temporary solution, string will be changed to bytes32 removing the need for this conversion
        if (claimsHelper.isClaimConfirmed(string(abi.encode(_signedBatchHash)))) {
            return;
        }

        _submitSignedBatch(_signedBatch, _batchIdStr, _signedBatchHash);
    }

    function _submitSignedBatch(
        SignedBatch calldata _signedBatch,
        string memory _batchIdStr,
        bytes32 _signedBatchHash
    ) internal {
        multisigSignatures[_signedBatch.destinationChainId][_signedBatchHash].push(_signedBatch.multisigSignature);
        feePayerMultisigSignatures[_signedBatch.destinationChainId][_signedBatchHash].push(
            _signedBatch.feePayerMultisigSignature
        );

        uint256 votesCount = claimsHelper.setVoted(_batchIdStr, msg.sender, _signedBatchHash);

        if (votesCount >= validators.getQuorumNumberOfValidators()) {
            claimsHelper.setConfirmedSignedBatchData(_signedBatch);

            claimsHelper.setClaimConfirmed(_batchIdStr);

            lastConfirmedBatch[_signedBatch.destinationChainId] = ConfirmedBatch(
                lastConfirmedBatch[_signedBatch.destinationChainId].id + 1,
                _signedBatch.rawTransaction,
                multisigSignatures[_signedBatch.destinationChainId][_signedBatchHash],
                feePayerMultisigSignatures[_signedBatch.destinationChainId][_signedBatchHash]
            );

            claimsHelper.updateCurrentBatchBlock(_signedBatch.destinationChainId);
        }
    }

    function isBatchAlreadySubmittedBy(string calldata _destinationChain, address addr) public view returns (bool ok) {
        return claimsHelper.hasVoted(Strings.toString(lastConfirmedBatch[_destinationChain].id + 1), addr);
    }

    function getConfirmedBatch(string calldata _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
