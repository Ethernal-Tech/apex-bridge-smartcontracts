// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "./ClaimsHelper.sol";
import "./ValidatorsContract.sol";

contract SignedBatchManager is IBridgeContractStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeContractAddress;
    ClaimsHelper private claimsHelper;
    ValidatorsContract private validatorsContract;
    address private owner;

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
        address _bridgeContractAddress,
        address _claimsHelperAddress,
        address _validatorsContractAddress
    ) external onlyOwner {
        bridgeContractAddress = _bridgeContractAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validatorsContract = ValidatorsContract(_validatorsContractAddress);
    }

    function submitSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridgeContract {
        string memory _destinationChainId = _signedBatch.destinationChainId;
        uint256 _batchId = _signedBatch.id;

        uint256 sbId = lastConfirmedBatch[_destinationChainId].id;

        if (_batchId != sbId + 1) {
            revert WrongBatchNonce(_destinationChainId, _batchId);
        }

        if (claimsHelper.hasVoted(Strings.toString(_batchId), _caller)) {
            revert AlreadyProposed(Strings.toString(_batchId));
        }

        if (claimsHelper.isClaimConfirmed(_destinationChainId, Strings.toString(_batchId))) {
            revert AlreadyConfirmed(Strings.toString(_batchId));
        }

        _submitSignedBatch(_signedBatch);
    }

    function _submitSignedBatch(SignedBatch calldata _signedBatch) internal {
        SignedBatchWithoutSignatures memory _signedBatchWithoutSignatures = SignedBatchWithoutSignatures(
            _signedBatch.id,
            _signedBatch.destinationChainId,
            _signedBatch.rawTransaction,
            _signedBatch.includedTransactions,
            _signedBatch.usedUTXOs
        );
        bytes32 signedBatchHash = keccak256(abi.encode(_signedBatchWithoutSignatures));
        claimsHelper.setVoted(Strings.toString(_signedBatch.id), msg.sender, signedBatchHash);

        signedBatches[_signedBatch.destinationChainId][_signedBatch.id][signedBatchHash].push(_signedBatch);

        if (hasConsensus(signedBatchHash)) {
            claimsHelper.setConfirmedSignedBatches(_signedBatch);

            claimsHelper.setClaimConfirmed(_signedBatch.destinationChainId, Strings.toString(_signedBatch.id));

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
        return claimsHelper.numberOfVotes(_hash) >= validatorsContract.getQuorumNumberOfValidators();
    }

    function isBatchAlreadySubmittedBy(string calldata _destinationChain, address addr) public view returns (bool ok) {
        return claimsHelper.hasVoted(Strings.toString(lastConfirmedBatch[_destinationChain].id + 1), addr);
    }

    function getConfirmedBatch(string calldata _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }
}
