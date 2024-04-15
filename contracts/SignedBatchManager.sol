// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ClaimsManager.sol";

import "hardhat/console.sol";

contract SignedBatchManager is IBridgeContractStructs {
    address private bridgeContractAddress;
    ClaimsHelper private claimsHelper;
    ClaimsManager private claimsManager;
    address private owner;

    // BlockchanID -> batchId -> -signedBatchWithoutSignaturesHash -> SignedBatch[]
    mapping(string => mapping(uint256 => mapping(bytes32 => SignedBatch[]))) public signedBatches;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(
        address _bridgeContractAddress,
        address _claimsManagerAddress,
        address _claimsHelperAddress
    ) external onlyOwner {
        bridgeContractAddress = _bridgeContractAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        claimsManager = ClaimsManager(_claimsManagerAddress);
    }

    function submitSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridgeContract {
        string memory _destinationChainId = _signedBatch.destinationChainId;
        uint256 _batchId = _signedBatch.id;

        (uint256 sbId, ) = claimsManager.lastConfirmedBatch(_destinationChainId);

        if (_batchId != sbId + 1) {
            revert WrongBatchNonce(_destinationChainId, _batchId);
        }

        if (claimsManager.voted(Strings.toString(_batchId), _caller)) {
            revert AlreadyProposed(Strings.toString(_batchId));
        }

        if (claimsHelper.isClaimConfirmed(_destinationChainId, Strings.toString(_batchId))) {
            revert AlreadyConfirmed(Strings.toString(_batchId));
        }

        _submitSignedBatch(_signedBatch);
    }

    function _submitSignedBatch(SignedBatch calldata _signedBatch) internal {
        claimsManager.setVoted(Strings.toString(_signedBatch.id), msg.sender, true);

        SignedBatchWithoutSignatures memory _signedBatchWithoutSignatures = SignedBatchWithoutSignatures(
            _signedBatch.id,
            _signedBatch.destinationChainId,
            _signedBatch.rawTransaction,
            _signedBatch.includedTransactions,
            _signedBatch.usedUTXOs
        );
        bytes32 signedBatchHash = keccak256(abi.encode(_signedBatchWithoutSignatures));
        claimsManager.setNumberOfVotes(signedBatchHash);

        signedBatches[_signedBatch.destinationChainId][_signedBatch.id][signedBatchHash].push(_signedBatch);

        if (claimsManager.hasConsensus(signedBatchHash)) {
            claimsManager.setConfirmedSignedBatches(_signedBatch.destinationChainId, _signedBatch.id, _signedBatch);

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

            (uint256 sbId, ) = claimsManager.lastConfirmedBatch(_signedBatch.destinationChainId);

            claimsManager.setLastConfirmedBatch(
                _signedBatch.destinationChainId,
                ConfirmedBatch(sbId + 1, _signedBatch.rawTransaction, multisigSignatures, feePayerMultisigSignatures)
            );

            claimsManager.setCurrentBatchBlock(_signedBatch.destinationChainId, int256(block.number));
        }
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
