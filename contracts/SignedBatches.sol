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

    // BlockchanID -> batchId -> -signedBatchWithoutSignaturesHash -> SignedBatch[]
    mapping(string => mapping(uint256 => mapping(bytes32 => SignedBatch[]))) public signedBatches;

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
        string memory _destinationChainId = _signedBatch.destinationChainId;
        string memory _batchIdStr = Strings.toString(_signedBatch.id);

        uint256 sbId = lastConfirmedBatch[_destinationChainId].id;

        if (_signedBatch.id != sbId + 1) {
            revert WrongBatchNonce(_destinationChainId, _signedBatch.id);
        }

        if (claimsHelper.hasVoted(_batchIdStr, _caller)) {
            return;
        }

        if (claimsHelper.isClaimConfirmed(_destinationChainId, _batchIdStr)) {
            return;
        }
        
        _submitSignedBatch(_signedBatch, _batchIdStr);
    }

    function _submitSignedBatch(SignedBatch calldata _signedBatch, string memory _batchId) internal {
        SignedBatchWithoutSignatures memory _signedBatchWithoutSignatures = SignedBatchWithoutSignatures(
            _signedBatch.id,
            _signedBatch.destinationChainId,
            _signedBatch.rawTransaction,
            _signedBatch.includedTransactions,
            _signedBatch.usedUTXOs
        );
        bytes32 signedBatchHash = keccak256(abi.encode(_signedBatchWithoutSignatures));
        claimsHelper.setVoted(_batchId, msg.sender, signedBatchHash);

        signedBatches[_signedBatch.destinationChainId][_signedBatch.id][signedBatchHash].push(_signedBatch);

        if (hasConsensus(signedBatchHash)) {
            claimsHelper.setConfirmedSignedBatches(_signedBatch);

            claimsHelper.setClaimConfirmed(_signedBatch.destinationChainId, _batchId);

            uint256 numberOfSignedBatches = signedBatches[_signedBatch.destinationChainId][_signedBatch.id][
                signedBatchHash
            ].length;

            string[] memory multisigSignatures = new string[](numberOfSignedBatches);
            string[] memory feePayerMultisigSignatures = new string[](numberOfSignedBatches);

            for (uint i = 0; i < numberOfSignedBatches; i++) {
                multisigSignatures[i] = signedBatches[_signedBatch.destinationChainId][_signedBatch.id][
                    signedBatchHash
                ][i].multisigSignature;
                feePayerMultisigSignatures[i] = signedBatches[_signedBatch.destinationChainId][_signedBatch.id][
                    signedBatchHash
                ][i].feePayerMultisigSignature;
            }

            uint256 sbId = lastConfirmedBatch[_signedBatch.destinationChainId].id;

            lastConfirmedBatch[_signedBatch.destinationChainId] = ConfirmedBatch(
                sbId + 1,
                _signedBatch.rawTransaction,
                multisigSignatures,
                feePayerMultisigSignatures
            );

            claimsHelper.setCurrentBatchBlock(_signedBatch.destinationChainId, int256(block.number));
        }
    }

    function hasConsensus(bytes32 _hash) public view returns (bool) {
        return claimsHelper.numberOfVotes(_hash) >= validators.getQuorumNumberOfValidators();
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
