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

    string private constant LAST_OBSERVED_BLOCK_INFO_KEY = "LAST_OBSERVED_BLOCK_INFO";

    constructor(address _bridgeContract, address _claimsHelper) {
        bridgeContract = BridgeContract(_bridgeContract);
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[i];
            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            if (!claimsHelper.isThereEnoughTokensToBridge(_claim)) {
                revert NotEnoughBridgingTokensAwailable(_claim.observedTransactionHash);
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[i];
            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }
            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[i];
            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            RefundRequestClaim memory _claim = _claims.refundRequestClaims[i];
            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[i];
            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsREC(_claims, i, _caller);
        }

        _submitLastObservedBlockInfo(_claims, _caller);
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsCounter[_claim.destinationChainID]++;

            chainTokenQuantity[_claim.sourceChainID] -= claimsHelper.getNeededTokenQuantity(_claim.receivers);

            claimsHelper.addToQueuedBridgingRequestsClaims(_claim);

            queuedClaims[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = _claim
                .observedTransactionHash;

            queuedClaimsTypes[_claim.destinationChainID][claimsCounter[_claim.destinationChainID]] = ClaimTypes
                .BRIDGING_REQUEST;

            claimsHelper.setClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash);
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            chainTokenQuantity[_claim.chainID] += signedBatchManager.getTokenQuantityFromSignedBatch(
                _claim.chainID,
                _claim.batchNonceID
            );

            claimsHelper.addToQueuedBatchExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            //claimsHelper.updateLastObservedBlockInfoIfNeeded(_claims);

            signedBatchManager.setCurrentBatchBlock(_claim.chainID, -1);

            bridgeContract.setLastBatchedClaim(_claim.chainID);

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS());

            utxosManager.updateUTXOs(_claim.chainID, _claim.outputUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedBatchExecutionFailedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            //claimsHelper.updateLastObservedBlockInfoIfNeeded(_claims);

            signedBatchManager.setCurrentBatchBlock(_claim.chainID, -1);

            bridgeContract.setNextTimeoutBlock(_claim.chainID, block.number + bridgeContract.MAX_NUMBER_OF_BLOCKS());
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundRequestClaim memory _claim = _claims.refundRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundRequestClaims(_claim);

            queuedClaims[_claim.chainID][claimsCounter[_claim.chainID]] = _claim.observedTransactionHash;

            queuedClaimsTypes[_claim.chainID][claimsCounter[_claim.chainID]] = ClaimTypes.REFUND_REQUEST;

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            claimsCounter[_claim.chainID]++;

            //claimsHelper.updateLastObservedBlockInfoIfNeeded(_claims);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (claimsHelper.hasConsensus(claimHash)) {
            claimsHelper.addToQueuedRefundExecutedClaims(_claim);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            //claimsHelper.updateLastObservedBlockInfoIfNeeded(_claims);
        }
    }

    function _submitLastObservedBlockInfo(ValidatorClaims calldata _claims, address _caller) internal {
        if (_claims.blockFullyObserved == false) {
            return;
        }
        if (voted[LAST_OBSERVED_BLOCK_INFO_KEY][_caller]) {
            revert AlreadyProposed(LAST_OBSERVED_BLOCK_INFO_KEY);
        }
        if (claimsHelper.isClaimConfirmed(_claims.chainID, LAST_OBSERVED_BLOCK_INFO_KEY)) {
            revert AlreadyConfirmed(LAST_OBSERVED_BLOCK_INFO_KEY);
        }

        voted[LAST_OBSERVED_BLOCK_INFO_KEY][_caller] = true;
        
        bytes memory combined = abi.encodePacked(_claims.chainID, _claims.blockHash, _claims.slot);
        bytes32 sumHash = keccak256(combined);
        numberOfVotes[sumHash]++;

        if (claimsHelper.hasConsensus(sumHash)) {
            LastObservedBlockInfo memory lastObservedBlock = claimsHelper.getLastObservedBlockInfo(_claims.chainID);
            if (_claims.slot < lastObservedBlock.slot) {
                revert InvalidSlot(_claims.slot);
            }
            LastObservedBlockInfo memory _lastObservedBlockInfo = LastObservedBlockInfo(
                _claims.blockHash, 
                _claims.slot
            );

            claimsHelper.setLastObservedBlockInfo(_claims.chainID, _lastObservedBlockInfo);
        
            claimsHelper.setClaimConfirmed(_claims.chainID, LAST_OBSERVED_BLOCK_INFO_KEY);
        
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
