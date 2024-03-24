// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    SignedBatchManager private signedBatchManager;
    UTXOsManager private utxosManager;

    // BlockchainID -> claimsCounter
    mapping(string => uint256) public claimsCounter;
    // BlockchainID -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // BlockchainID -> claimCounter -> claimType
    mapping(string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    mapping(string => uint256) public chainTokenQuantity;

    // ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    constructor(address _bridgeContract, address _claimsHelper) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (voted[_claims.bridgingRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            if (
                claimsHelper.isClaimConfirmed(
                    _claims.bridgingRequestClaims[i].destinationChainID,
                    _claims.bridgingRequestClaims[i].observedTransactionHash
                )
            ) {
                revert AlreadyConfirmed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            if (!claimsHelper.isThereEnoughTokensToBridge(_claims.bridgingRequestClaims[i])) {
                revert NotEnoughBridgingTokensAwailable(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (voted[_claims.batchExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (
                claimsHelper.isClaimConfirmed(
                    _claims.batchExecutedClaims[i].chainID,
                    _claims.batchExecutedClaims[i].observedTransactionHash
                )
            ) {
                revert AlreadyConfirmed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }

            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (voted[_claims.batchExecutionFailedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }

            if (
                claimsHelper.isClaimConfirmed(
                    _claims.batchExecutionFailedClaims[i].chainID,
                    _claims.batchExecutionFailedClaims[i].observedTransactionHash
                )
            ) {
                revert AlreadyConfirmed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }

            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (voted[_claims.refundRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }

            if (
                claimsHelper.isClaimConfirmed(
                    _claims.refundRequestClaims[i].chainID,
                    _claims.refundRequestClaims[i].observedTransactionHash
                )
            ) {
                revert AlreadyConfirmed(_claims.refundRequestClaims[i].observedTransactionHash);
            }

            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (voted[_claims.refundExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }

            if (
                claimsHelper.isClaimConfirmed(
                    _claims.refundExecutedClaims[i].chainID,
                    _claims.refundExecutedClaims[i].observedTransactionHash
                )
            ) {
                revert AlreadyConfirmed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }

            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.bridgingRequestClaims[index].observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claims.bridgingRequestClaims[index]));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]++;

            chainTokenQuantity[_claims.bridgingRequestClaims[index].sourceChainID] -= claimsHelper
                .getNeededTokenQuantity(_claims.bridgingRequestClaims[index].receivers);

            claimsHelper.addToQueuedBridgingRequestsClaims(_claims.bridgingRequestClaims[index]);

            queuedClaims[_claims.bridgingRequestClaims[index].destinationChainID][
                claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]
            ] = _claims.bridgingRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.bridgingRequestClaims[index].destinationChainID][
                claimsCounter[_claims.bridgingRequestClaims[index].destinationChainID]
            ] = ClaimTypes.BRIDGING_REQUEST;

            claimsHelper.setClaimConfirmed(
                _claims.bridgingRequestClaims[index].destinationChainID,
                _claims.bridgingRequestClaims[index].observedTransactionHash
            );
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutedClaims[index].observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claims.batchExecutedClaims[index]));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            chainTokenQuantity[_claims.batchExecutedClaims[index].chainID] += signedBatchManager
                .getTokenQuantityFromSignedBatch(
                    _claims.batchExecutedClaims[index].chainID,
                    _claims.batchExecutedClaims[index].batchNonceID
                );

            claimsHelper.addToQueuedBatchExecutedClaims(_claims.batchExecutedClaims[index]);

            claimsHelper.setClaimConfirmed(
                _claims.batchExecutedClaims[index].chainID,
                _claims.batchExecutedClaims[index].observedTransactionHash
            );

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            signedBatchManager.setCurrentBatchBlock(_claims.batchExecutedClaims[index].chainID, -1);

            bridgeContract.setNextTimeoutBlock(
                _claims.batchExecutedClaims[index].chainID,
                block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            );
            utxosManager.updateUTXOs(
                _claims.batchExecutedClaims[index].chainID,
                _claims.batchExecutedClaims[index].outputUTXOs
            );
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutionFailedClaims[index].observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claims.batchExecutionFailedClaims[index]));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(_claims.batchExecutionFailedClaims[index]);

            claimsHelper.setClaimConfirmed(
                _claims.batchExecutionFailedClaims[index].chainID,
                _claims.batchExecutionFailedClaims[index].observedTransactionHash
            );

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            signedBatchManager.setCurrentBatchBlock(_claims.batchExecutionFailedClaims[index].chainID, -1);

            bridgeContract.setNextTimeoutBlock(
                _claims.batchExecutionFailedClaims[index].chainID,
                block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            );
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claims.refundRequestClaims[index]));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundRequestClaims(_claims.refundRequestClaims[index]);

            queuedClaims[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = ClaimTypes.REFUND_REQUEST;

            claimsHelper.setClaimConfirmed(
                _claims.refundRequestClaims[index].chainID,
                _claims.refundRequestClaims[index].observedTransactionHash
            );

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claims.refundExecutedClaims[index]));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claims.refundExecutedClaims[index]);

            claimsHelper.setClaimConfirmed(
                _claims.refundExecutedClaims[index].chainID,
                _claims.refundExecutedClaims[index].observedTransactionHash
            );

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function setVoted(
        string calldata _id,
        address _voter,
        bool _value
    ) external onlySignedBatchManagerOrBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(bytes32 _hash) external onlySignedBatchManagerOrBridgeContract {
        numberOfVotes[_hash]++;
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridgeContract {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    // TODO: who will set this value?
    function setUTXOsManager(address _utxosManager) external {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setSignedBatchManager(address _signedBatchManager) external {
        signedBatchManager = SignedBatchManager(_signedBatchManager);
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlySignedBatchManagerOrBridgeContract() {
        if (msg.sender != address(signedBatchManager) && msg.sender != address(bridgeContract))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
