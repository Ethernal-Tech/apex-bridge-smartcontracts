// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ClaimsManager.sol";
import "./UTXOsManager.sol";

import "hardhat/console.sol";

contract SignedBatchManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    ClaimsManager private claimsManager;
    UTXOsManager private utxosManager;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // blockchainID -> nounce
    mapping(string => uint256) public confirmedBatchNounce;

    // BlockchainID -> batchId
    mapping(string => uint256) public lastConfirmedBatch;

    // BlockchainID -> batchID -> ConfirmedBatch
    mapping(string => mapping(uint256 => ConfirmedBatch)) public confirmedBatches;

    // BlockchanID -> batchId -> -signedBatchWithoutSignaturesHash -> SignedBatch[]
    mapping(string => mapping(uint256 => mapping(bytes32 => SignedBatch[]))) public signedBatches;

    // BlockchainID -> batchId -> SignedBatch
    mapping(string => mapping(uint256 => SignedBatch)) public confirmedSignedBatches;

    constructor(address _bridgeContract, address _claimsManager, address _claimsHelper, address _utxosManager) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsManager = ClaimsManager(_claimsManager);
        claimsHelper = ClaimsHelper(_claimsHelper);
        utxosManager = UTXOsManager(_utxosManager);
    }

    function submitSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridgeContract {
        // TODO: call precompile to check if signedBatch is valid

        if (claimsManager.voted(Strings.toString(_signedBatch.id), _caller)) {
            revert AlreadyProposed(Strings.toString(_signedBatch.id));
        }

        if (claimsHelper.isClaimConfirmed(_signedBatch.destinationChainId, Strings.toString(_signedBatch.id))) {
            revert AlreadyConfirmed(Strings.toString(_signedBatch.id));
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

        if (claimsHelper.hasConsensus(signedBatchHash)) {
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

            ConfirmedBatch memory _confirmedBatch = ConfirmedBatch(
                ++confirmedBatchNounce[_signedBatch.destinationChainId],
                _signedBatch.rawTransaction,
                multisigSignatures,
                feePayerMultisigSignatures
            );

            confirmedBatches[_signedBatch.destinationChainId][
                confirmedBatchNounce[_signedBatch.destinationChainId]
            ] = _confirmedBatch;

            lastConfirmedBatch[_signedBatch.destinationChainId] = confirmedBatchNounce[_signedBatch.destinationChainId];

            currentBatchBlock[_signedBatch.destinationChainId] = int256(block.number);
        }
    }

    function isBatchCreated(string calldata _destinationChain) public view onlyBridgeContract returns (bool batch) {
        return currentBatchBlock[_destinationChain] != int(-1);
    }

    function isBatchAlreadySubmittedBy(string calldata _destinationChain, address addr) public view onlyBridgeContract returns (bool ok) {
         return claimsManager.voted(Strings.toString(confirmedBatchNounce[_destinationChain] + 1), addr);
    }

    function getNewBatchId(string calldata _destinationChain) public view onlyBridgeContract returns (uint256 v) {
        return confirmedBatchNounce[_destinationChain] + 1;
    }

    function getTokenQuantityFromSignedBatch(
        string calldata _chainId,
        uint256 _batchNonceID
    ) external view returns (uint256) {
        uint256[] memory _signedBatchTxNonces = confirmedSignedBatches[_chainId][_batchNonceID].includedTransactions;
        ConfirmedTransaction[] memory _includedTransactions = new ConfirmedTransaction[](_signedBatchTxNonces.length);
        for (uint i = 0; i < _signedBatchTxNonces.length; i++) {
            _includedTransactions[i] = claimsManager.getConfirmedTransaction(_chainId, _signedBatchTxNonces[i]);
        }
        uint256 bridgedAmount;

        for (uint256 i = 0; i < _includedTransactions.length; i++) {
            for (uint256 j = 0; j < _includedTransactions[i].receivers.length; j++) {
                bridgedAmount += _includedTransactions[i].receivers[j].amount;
                j++;
            }
            i++;
        }

        return bridgedAmount;
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view onlyBridgeContract returns (ConfirmedBatch memory batch) {
        return confirmedBatches[_destinationChain][lastConfirmedBatch[_destinationChain]];
    }

    function getConfirmedSignedBatch(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (SignedBatch memory signedBatch) {
        return confirmedSignedBatches[_destinationChain][_nonce];
    }

    function setCurrentBatchBlock(
        string calldata _chainId,
        int256 _blockNumber
    ) external onlyClaimsManagerOrBridgeContract {
        currentBatchBlock[_chainId] = int(_blockNumber);
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }

    modifier onlyClaimsHelper() {
        if (msg.sender != address(claimsHelper)) revert NotClaimsHelper();
        _;
    }

    modifier onlyClaimsManagerOrBridgeContract() {
        if (msg.sender != address(claimsManager) && msg.sender != address(bridgeContract))
            revert NotClaimsManagerOrBridgeContract();
        _;
    }
}
