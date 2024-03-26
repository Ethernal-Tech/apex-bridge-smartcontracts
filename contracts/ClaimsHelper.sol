// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsHelper is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    ClaimsManager private claimsManager;
    UTXOsManager private utxosManager;
    address private signedBatchManager;

    // blockchain -> claimHash -> queued
    mapping(string => mapping(string => bool)) public isClaimConfirmed;

    // BlockchainID -> claimHash -> bool
    mapping(string => mapping(string => bool)) public isClaimHashed;

    // claimHash -> claim
    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;
    mapping(string => BatchExecutedClaim) public queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) public queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) public queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) public queuedRefundExecutedClaims;

    // BlockchainID -> LastObservedBlockInfo
    mapping(string => LastObservedBlockInfo) public lastObservedBlockInfos;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function updateLastObservedBlockInfoIfNeeded(ValidatorClaims calldata _claims) external onlyClaimsManager {
        if (_claims.blockFullyObserved) {
            string memory chainId;
            if (_claims.bridgingRequestClaims.length > 0) {
                chainId = _claims.bridgingRequestClaims[0].sourceChainID;
            } else if (_claims.batchExecutedClaims.length > 0) {
                chainId = _claims.batchExecutedClaims[0].chainID;
            } else if (_claims.batchExecutionFailedClaims.length > 0) {
                chainId = _claims.batchExecutionFailedClaims[0].chainID;
            } else if (_claims.refundRequestClaims.length > 0) {
                chainId = _claims.refundRequestClaims[0].chainID;
            } else if (_claims.refundExecutedClaims.length > 0) {
                chainId = _claims.refundExecutedClaims[0].chainID;
            }

            LastObservedBlockInfo memory _lastObservedBlockInfo = LastObservedBlockInfo(
                _claims.blockHash, 
                _claims.slot
            );

            lastObservedBlockInfos[chainId] = _lastObservedBlockInfo;
        
        }
    }

    function hasConsensus(bytes32 _hash) public view returns (bool) {
        if (
            claimsManager.numberOfVotes(_hash) >=
            ((bridgeContract.validatorsCount() * 2) / 3 + ((bridgeContract.validatorsCount() * 2) % 3 == 0 ? 0 : 1))
        ) {
            return true;
        }
        return false;
    }

    function hasChainRegistrationConsensus(bytes32 _hash) public view returns (bool) {
        if (claimsManager.numberOfVotes(_hash) == bridgeContract.validatorsCount()) {
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

    function addToQueuedBatchExecutionFailedClaims(
        BatchExecutionFailedClaim calldata _claim
    ) external onlyClaimsManager {
        queuedBatchExecutionFailedClaims[_claim.observedTransactionHash] = _claim;
    }

    function isThereEnoughTokensToBridge(BridgingRequestClaim calldata _claim) external view returns (bool) {
        if (claimsManager.chainTokenQuantity(_claim.sourceChainID) < getNeededTokenQuantity(_claim.receivers)) {
            revert NotEnoughBridgingTokensAwailable(_claim.observedTransactionHash);
        }

        return true;
    }

    function getNeededTokenQuantity(Receiver[] calldata _receivers) public pure returns (uint256) {
        uint256 tokenQuantity;

        for (uint256 i = 0; i < _receivers.length; i++) {
            tokenQuantity += _receivers[i].amount;
        }

        return tokenQuantity;
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchManagerOrClaimsManager {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function setLastObservedBlockInfo(string calldata chainID, LastObservedBlockInfo calldata lastObservedBlockInfo) public {
        lastObservedBlockInfos[chainID] = lastObservedBlockInfo;
    }

    function getLastObservedBlockInfo(string calldata chainID) public view returns (LastObservedBlockInfo memory) {
        return lastObservedBlockInfos[chainID];
    }

    function calculateChainHash(Chain calldata chain) public pure returns (bytes32) {
        bytes32 utxosHash;
        for (uint i = 0; i < chain.utxos.multisigOwnedUTXOs.length; i++) {
            utxosHash = keccak256(abi.encodePacked(utxosHash, chain.utxos.multisigOwnedUTXOs[i].txHash, chain.utxos.multisigOwnedUTXOs[i].txIndex, chain.utxos.multisigOwnedUTXOs[i].addressUTXO, chain.utxos.multisigOwnedUTXOs[i].amount));
        }
        for (uint i = 0; i < chain.utxos.feePayerOwnedUTXOs.length; i++) {
            utxosHash = keccak256(abi.encodePacked(utxosHash, chain.utxos.feePayerOwnedUTXOs[i].txHash, chain.utxos.feePayerOwnedUTXOs[i].txIndex, chain.utxos.feePayerOwnedUTXOs[i].addressUTXO, chain.utxos.feePayerOwnedUTXOs[i].amount));
        }
        bytes32 chainHash = keccak256(abi.encodePacked(chain.id, utxosHash, chain.addressMultisig, chain.addressFeePayer, chain.tokenQuantity));

        return chainHash;
        
    }

    function _equal(string memory a, string memory b) internal pure returns (bool) {
        return bytes(a).length == bytes(b).length && keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _equalReveivers(Receiver[] memory a, Receiver[] memory b) internal pure returns (bool) {
        if (a.length != b.length) {
            return false;
        }

        for (uint256 i = 0; i < a.length; i++) {
            if (!_equal(a[i].destinationAddress, b[i].destinationAddress)) {
                return false;
            }
            if (a[i].amount != b[i].amount) {
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

    function setSignedBatchManagerAddress(address _signedBatchManager) external {
        signedBatchManager = _signedBatchManager;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }

    modifier onlySignedBatchManagerOrClaimsManager() {
        if (msg.sender != address(signedBatchManager) && msg.sender != address(claimsManager))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
