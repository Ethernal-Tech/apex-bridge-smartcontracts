// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsHelper private claimsHelper;
    UTXOsManager private utxosManager;

    // BlockchainID -> claimsCounter
    mapping(string => uint256) public claimsCounter;
    // BlockchainID -> claimCounter -> claimHash
    mapping(string => mapping(uint256 => string)) public queuedClaims;
    // BlockchainID -> claimCounter -> claimType
    mapping(string => mapping(uint256 => ClaimTypes)) public queuedClaimsTypes;

    //working version
    // BlockchainID -> claimHash -> bool
    mapping(string => mapping(string => bool)) public isClaimHashed;
    // BlockchainID -> claimHash -> keccak256(claim)
    mapping(string => mapping(string => bytes32)) public claimsHashes;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    mapping(string => uint256) public chainTokenQuantity;

    // TansactionHash -> numberOfVotes
    mapping(string => uint8) public numberOfVotes;

    constructor(address _bridgeContract, address _claimsHelper) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (voted[_claims.bridgingRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            if (claimsHelper.isAlreadyQueuedBRC(_claims.bridgingRequestClaims[i])) {
                revert AlreadyQueued(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }

            //TODO: "locks" the hash to the claim that might not be valid :(
            if (
                !isClaimHashed[_claims.bridgingRequestClaims[i].sourceChainID][
                    _claims.bridgingRequestClaims[i].observedTransactionHash
                ]
            ) {
                if (!claimsHelper.isThereEnoughTokensToBridge(_claims.bridgingRequestClaims[i])) {
                    revert NotEnoughBridgingTokensAwailable(_claims.bridgingRequestClaims[i].observedTransactionHash);
                }
                claimsHashes[_claims.bridgingRequestClaims[i].sourceChainID][
                    _claims.bridgingRequestClaims[i].observedTransactionHash
                ] = keccak256(abi.encode(_claims.bridgingRequestClaims[i]));
                isClaimHashed[_claims.bridgingRequestClaims[i].sourceChainID][
                    _claims.bridgingRequestClaims[i].observedTransactionHash
                ] = true;
            } else {
                if (
                    claimsHashes[_claims.bridgingRequestClaims[i].sourceChainID][
                        _claims.bridgingRequestClaims[i].observedTransactionHash
                    ] != keccak256(abi.encode(_claims.bridgingRequestClaims[i]))
                ) {
                    revert DoesNotMatchAreadyStoredClaim(_claims.bridgingRequestClaims[i].observedTransactionHash);
                }
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (claimsHelper.isAlreadyQueuedBEC(_claims.batchExecutedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (claimsHelper.isAlreadyQueuedBEFC(_claims.batchExecutionFailedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.batchExecutionFailedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (claimsHelper.isAlreadyQueuedRRC(_claims.refundRequestClaims[i])) {
                revert AlreadyQueued(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundRequestClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (claimsHelper.isAlreadyQueuedREC(_claims.refundExecutedClaims[i])) {
                revert AlreadyQueued(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            if (voted[_claims.refundExecutedClaims[i].observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.bridgingRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
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
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.batchExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            chainTokenQuantity[_claims.batchExecutedClaims[index].chainID] += bridgeContract
                .getTokenQuantityFromSignedBatch(
                    _claims.batchExecutedClaims[index].chainID,
                    _claims.batchExecutedClaims[index].batchNonceID
                );

            claimsHelper.addToQueuedBatchExecutedClaims(_claims.batchExecutedClaims[index]);

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutedClaims[index].chainID, -1);

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
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(_claims.batchExecutionFailedClaims[index]);

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);

            bridgeContract.setCurrentBatchBlock(_claims.batchExecutionFailedClaims[index].chainID, -1);

            bridgeContract.setNextTimeoutBlock(
                _claims.batchExecutionFailedClaims[index].chainID,
                block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS()
            );
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundRequestClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedRefundRequestClaims(_claims.refundRequestClaims[index]);

            queuedClaims[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = _claims.refundRequestClaims[index].observedTransactionHash;

            queuedClaimsTypes[_claims.refundRequestClaims[index].chainID][
                claimsCounter[_claims.refundRequestClaims[index].chainID]
            ] = ClaimTypes.REFUND_REQUEST;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        voted[_claims.refundExecutedClaims[index].observedTransactionHash][_caller] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (claimsHelper.hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claims.refundExecutedClaims[index]);

            claimsHelper.updateLastObservedBlockIfNeeded(_claims);
        }
    }

    function setVoted(string calldata _id, address _voter, bool _value) external onlyBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(string calldata _id) external onlyBridgeContract {
        numberOfVotes[_id]++;
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridgeContract {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    // TODO: who will set this value?
    function setUTXOsManager(address _utxosManager) external {
        utxosManager = UTXOsManager(_utxosManager);
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }
}
