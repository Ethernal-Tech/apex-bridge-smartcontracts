// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsHelper is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsManager private claimsManager;
    BridgedTokensManager private bridgedTokensManager;
    UTXOsManager private utxosManager;

    //  claimHash -> claim
    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) public queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) public queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) public queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) public queuedRefundExecutedClaims;

    //  Blochchain ID -> blockHash
    mapping(string => string) public lastObserveredBlock;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function updateLastObservedBlockIfNeeded(ValidatorClaims calldata _claims) external onlyClaimsManager{
        if (_claims.blockFullyObserved) {
            string memory chainId;
            if(_claims.bridgingRequestClaims.length > 0) {
                chainId = _claims.bridgingRequestClaims[0].sourceChainID;
            } else if(_claims.batchExecutedClaims.length > 0) {
                chainId = _claims.batchExecutedClaims[0].chainID;
            } else if(_claims.batchExecutionFailedClaims.length > 0) {
                chainId = _claims.batchExecutionFailedClaims[0].chainID;
            } else if(_claims.refundRequestClaims.length > 0) {
                chainId = _claims.refundRequestClaims[0].chainID;
            } else if(_claims.refundExecutedClaims.length > 0) {
                chainId = _claims.refundExecutedClaims[0].chainID;
            }

            lastObserveredBlock[chainId] = _claims.blockHash;
        }
    }
    
    // TODO: claims might differ if inluding signature, check the claims and implement
    // different way of comparison
    function isQueuedBRC(BridgingRequestClaim calldata _claim) public view returns (bool) {
        // return
        //     keccak256(abi.encode(_claim)) ==
        //     keccak256(abi.encode(queuedBridgingRequestsClaims[_claim.observedTransactionHash]));

        return
            _equal(_claim.observedTransactionHash, queuedBridgingRequestsClaims[_claim.observedTransactionHash].observedTransactionHash) &&
            utxosManager.equalUTXO(_claim.outputUTXO, queuedBridgingRequestsClaims[_claim.observedTransactionHash].outputUTXO) &&
            _equalReveivers(_claim.receivers, queuedBridgingRequestsClaims[_claim.observedTransactionHash].receivers) &&
            _equal(_claim.sourceChainID, queuedBridgingRequestsClaims[_claim.observedTransactionHash].sourceChainID) &&
            _equal(_claim.destinationChainID, queuedBridgingRequestsClaims[_claim.observedTransactionHash].destinationChainID);
    }

    function isQueuedBEC(BatchExecutedClaim calldata _claim) public view returns (bool) {
        return
            _equal(_claim.observedTransactionHash, queuedBatchExecutedClaims[_claim.observedTransactionHash].observedTransactionHash) &&
            _equal(_claim.chainID, queuedBatchExecutedClaims[_claim.observedTransactionHash].chainID) &&
            _claim.batchNonceID == queuedBatchExecutedClaims[_claim.observedTransactionHash].batchNonceID &&
            utxosManager.equalUTXOs(_claim.outputUTXOs, queuedBatchExecutedClaims[_claim.observedTransactionHash].outputUTXOs);


    }

    function isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) public view returns (bool) {        
        return
            _equal(_claim.observedTransactionHash, queuedBatchExecutionFailedClaims[_claim.observedTransactionHash].observedTransactionHash) &&
            _equal(_claim.chainID, queuedBatchExecutionFailedClaims[_claim.observedTransactionHash].chainID) &&
            _claim.batchNonceID == queuedBatchExecutionFailedClaims[_claim.observedTransactionHash].batchNonceID;
    }

    function isQueuedRRC(RefundRequestClaim calldata _claim) public view returns (bool) {
        return
            _equal(_claim.observedTransactionHash, queuedRefundRequestClaims[_claim.observedTransactionHash].observedTransactionHash) &&
            _equal(_claim.previousRefundTxHash, queuedRefundRequestClaims[_claim.observedTransactionHash].previousRefundTxHash) &&
            _equal(_claim.chainID, queuedRefundRequestClaims[_claim.observedTransactionHash].chainID) &&
            _equal(_claim.receiver, queuedRefundRequestClaims[_claim.observedTransactionHash].receiver) &&
            utxosManager.equalUTXO(_claim.utxo, queuedRefundRequestClaims[_claim.observedTransactionHash].utxo) &&
            _equal(_claim.rawTransaction, queuedRefundRequestClaims[_claim.observedTransactionHash].rawTransaction) &&
            _claim.retryCounter == queuedRefundRequestClaims[_claim.observedTransactionHash].retryCounter;
    }

    function isQueuedREC(RefundExecutedClaim calldata _claim) public view returns (bool) {
        return 
            _equal(_claim.observedTransactionHash, queuedRefundExecutedClaims[_claim.observedTransactionHash].observedTransactionHash) &&
            _equal(_claim.chainID, queuedRefundExecutedClaims[_claim.observedTransactionHash].chainID) &&
            _equal(_claim.refundTxHash, queuedRefundExecutedClaims[_claim.observedTransactionHash].refundTxHash) &&
            utxosManager.equalUTXO(_claim.utxo, queuedRefundExecutedClaims[_claim.observedTransactionHash].utxo);
    }

    function hasConsensus(string calldata _id) public view returns (bool) {
        if (claimsManager.numberOfVotes(_id) >= ((bridgeContract.validatorsCount() * 2) / 3 + ((bridgeContract.validatorsCount() * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }

    function getClaimBRC(string calldata _id) external view returns (BridgingRequestClaim memory claim) {
        return queuedBridgingRequestsClaims[_id];
    }

    function addToQueuedBridgingRequestsClaims(BridgingRequestClaim calldata _claim) external onlyClaimsManager {
        queuedBridgingRequestsClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedBatchExecutedClaims(BatchExecutedClaim calldata _claim) external onlyClaimsManager {
        queuedBatchExecutedClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedRefundRequestClaims(RefundRequestClaim calldata _claim) external onlyClaimsManager {
        queuedRefundRequestClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedRefundExecutedClaims(RefundExecutedClaim calldata _claim) external onlyClaimsManager {
        queuedRefundExecutedClaims[_claim.observedTransactionHash] = _claim;
    }

    function addToQueuedBatchExecutionFailedClaims(BatchExecutionFailedClaim calldata _claim) external onlyClaimsManager {
        queuedBatchExecutionFailedClaims[_claim.observedTransactionHash] = _claim;
    }

    function isThereEnoughTokensToBridge(BridgingRequestClaim calldata _claim) external view returns (bool) {
            
        if (bridgedTokensManager.chainTokenQuantity(_claim.sourceChainID) < getNeededTokenQuantity(_claim)) {
            revert NotEnoughBridgingTokensAwailable(_claim.observedTransactionHash);
        }

        return true;
    }

    function getNeededTokenQuantity(BridgingRequestClaim calldata _claim) public pure returns (uint256) {
        uint256 tokenQuantity;

        for (uint256 i = 0; i<_claim.receivers.length; i++) {
            tokenQuantity += _claim.receivers[i].amount;
        }

        return tokenQuantity;
    }

    function _equal(string memory a, string memory b) internal pure returns (bool) {
        return bytes(a).length == bytes(b).length && keccak256(bytes(a)) == keccak256(bytes(b));
    }
    
    function  _equalReveivers(Receiver[] memory a, Receiver[] memory b) internal pure returns (bool) {
        if(a.length != b.length){
            return false;
        }

        for(uint256 i = 0; i < a.length; i++) {
            if(!_equal(a[i].destinationAddress, b[i].destinationAddress)) {
                return false;
            }
            if(a[i].amount != b[i].amount) {
                return false;
            }
        }

        return true;
    }

    //TODO: think about constraint for setting this value
    function setClaimsManager(address _claimsManager) external {
        claimsManager = ClaimsManager(_claimsManager);
    }

    function setUTXOsManager(address _utxosManager) external {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setBridgedTokensManager(address _bridgedTokensManager) external {
        bridgedTokensManager = BridgedTokensManager(_bridgedTokensManager);
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
       if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }
   
}