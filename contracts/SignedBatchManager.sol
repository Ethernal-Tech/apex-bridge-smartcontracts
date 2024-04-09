// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ClaimsManager.sol";

import "hardhat/console.sol";

contract SignedBatchManager is IBridgeContractStructs {
    address private bridgeContract;
    ClaimsHelper private claimsHelper;
    ClaimsManager private claimsManager;
    address private owner;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // BlockchainID -> ConfirmedBatch
    mapping(string => ConfirmedBatch) public lastConfirmedBatch;

    // BlockchanID -> batchId -> -signedBatchWithoutSignaturesHash -> SignedBatch[]
    mapping(string => mapping(uint256 => mapping(bytes32 => SignedBatch[]))) public signedBatches;

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => SignedBatch)) public confirmedSignedBatches;

    constructor(address _bridgeContract) {
        owner = msg.sender;
        bridgeContract = _bridgeContract;
    }

    function submitSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridgeContract {
        string memory _destinationChainId = _signedBatch.destinationChainId;
        uint256 _batchId = _signedBatch.id;

        if (_batchId != lastConfirmedBatch[_destinationChainId].id + 1) {
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
            confirmedSignedBatches[_signedBatch.destinationChainId][_signedBatch.id] = _signedBatch;

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

            lastConfirmedBatch[_signedBatch.destinationChainId] = ConfirmedBatch(
                lastConfirmedBatch[_signedBatch.destinationChainId].id + 1,
                _signedBatch.rawTransaction,
                multisigSignatures,
                feePayerMultisigSignatures
            );

            currentBatchBlock[_signedBatch.destinationChainId] = int256(block.number);
        }
    }

    function isBatchCreated(string calldata _destinationChain) public view onlyBridgeContract returns (bool batch) {
        return currentBatchBlock[_destinationChain] != int(-1);
    }

    function isBatchAlreadySubmittedBy(
        string calldata _destinationChain,
        address addr
    ) public view onlyBridgeContract returns (bool ok) {
        return claimsManager.voted(Strings.toString(lastConfirmedBatch[_destinationChain].id + 1), addr);
    }

    function getNewBatchId(string calldata _destinationChain) public view onlyBridgeContract returns (uint256 v) {
        return lastConfirmedBatch[_destinationChain].id + 1;
    }

    function getConfirmedBatch(string calldata _destinationChain) external view returns (ConfirmedBatch memory batch) {
        return lastConfirmedBatch[_destinationChain];
    }

    function getConfirmedSignedBatch(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (SignedBatch memory signedBatch) {
        return confirmedSignedBatches[_destinationChain][_nonce];
    }

    function getRawTransactionFromLastBatch(string calldata _destinationChain) external view returns (string memory) {
        return lastConfirmedBatch[_destinationChain].rawTransaction;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyClaimsManagerOrBridgeContract {
        currentBatchBlock[_chainId] = int(-1);
    }

    function setClaimsManager(address _claimsManager) external onlyOwner {
        claimsManager = ClaimsManager(_claimsManager);
    }

    function setClaimsHelper(address _claimsHelper) external onlyOwner {
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContract) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManagerOrBridgeContract() {
        if (msg.sender != address(claimsManager) && msg.sender != bridgeContract)
            revert NotClaimsManagerOrBridgeContract();
        _;
    }
}
