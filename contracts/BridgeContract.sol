// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";

contract BridgeContract is IBridgeContract {
    mapping(address => bool) private validators; // mapping in case they could be added/removed
    mapping(string => bool) private registeredChains;

    mapping(string => mapping(address => bool)) private voters;
    mapping(string => uint8) private numberOfVotes;

    // mapping(string => BridgingRequestClaim) private queuedBridgingRequestsClaims;
    // mapping(string => BatchExecutedClaim) private queuedBatchExecutedClaims;
    // mapping(string => BatchExecutionFailedClaim) private queuedBatchExecutionFailedClaims;
    // mapping(string => RefundRequestClaim) private queuedRefundRequestClaims;
    // mapping(string => RefundExecutedClaim) private queuedRefundExecutedClaims;

    //claimHash -> claimß
    mapping(string => BridgingRequestClaim) private queuedBridgingRequestsClaims;    
    mapping(string => BatchExecutedClaim) private queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) private queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) private queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) private queuedRefundExecutedClaims;

    //Blockchain -> claimCounter -> claimHash
    mapping(string => mapping(uint64 => string)) private queuedClaims;
        
    //Blockchain -> claimsCounter
    mapping(string => uint64) private claimsCounter;

    //mapping(uint256 => mapping(ClaimTypes => mapping(string => string[]))) private queuedClaims;

    Chain[] private chains;
    address private owner;
    uint16 private constant MAX_NUMBER_OF_TRANSACTIONS = 200;
    uint8 private constant MAX_NUMBER_OF_BLOCKS = 5;
    uint8 private validatorsCount;
    constructor(address[] memory _validators) {
        for (uint i = 0; i < _validators.length; i++) {
            validators[_validators[i]] = true;
        }
        validatorsCount = uint8(_validators.length);
        owner = msg.sender;
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            if (_isQueuedBRC(_claims.bridgingRequestClaims[i])) {
                revert AlreadyQueued(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            if (_hasVoted(_claims.bridgingRequestClaims[i].observedTransactionHash)) {
                revert AlreadyProposed(_claims.bridgingRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsBRC(_claims, i);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            if (_isQueuedBEC(_claims.batchExecutedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            if (_hasVoted(_claims.batchExecutedClaims[i].observedTransactionHash)) {
                revert AlreadyProposed(_claims.batchExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEC(_claims, i);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            if (_isQueuedBEFC(_claims.batchExecutionFailedClaims[i])) {
                revert AlreadyQueued(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            if (_hasVoted(_claims.batchExecutionFailedClaims[i].observedTransactionHash)) {
                revert AlreadyProposed(_claims.batchExecutionFailedClaims[i].observedTransactionHash);
            }
            _submitClaimsBEFC(_claims, i);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            if (_isQueuedRRC(_claims.refundRequestClaims[i])) {
                revert AlreadyQueued(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            if (_hasVoted(_claims.refundRequestClaims[i].observedTransactionHash)) {
                revert AlreadyProposed(_claims.refundRequestClaims[i].observedTransactionHash);
            }
            _submitClaimsRRC(_claims, i);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            if (_isQueuedREC(_claims.refundExecutedClaims[i])) {
                revert AlreadyQueued(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            if (_hasVoted(_claims.refundExecutedClaims[i].observedTransactionHash)) {
                revert AlreadyProposed(_claims.refundExecutedClaims[i].observedTransactionHash);
            }
            _submitClaimsREC(_claims, i);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.bridgingRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash] = _claims
                .bridgingRequestClaims[index];

            // queuedClaims[claimsCounter][ClaimTypes.BRIDGING_REQUEST][_claims.bridgingRequestClaims[index].sourceChainID].push(
            //     _claims.bridgingRequestClaims[index].observedTransactionHash
            // );

            queuedClaims[_claims.bridgingRequestClaims[index].sourceChainID][claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]] = 
                _claims.bridgingRequestClaims[index].observedTransactionHash;

            claimsCounter[_claims.bridgingRequestClaims[index].sourceChainID]++;
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.batchExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            queuedBatchExecutedClaims[_claims.batchExecutedClaims[index].observedTransactionHash] = _claims
                .batchExecutedClaims[index];

            // queuedClaims[claimsCounter][ClaimTypes.BATCH_EXECUTED][_claims.batchExecutedClaims[index].chainID].push(
            //     _claims.batchExecutedClaims[index].observedTransactionHash
            // );

            queuedClaims[_claims.batchExecutedClaims[index].chainID][claimsCounter[_claims.batchExecutedClaims[index].chainID]] = _claims.batchExecutedClaims[index].observedTransactionHash;

            claimsCounter[_claims.batchExecutedClaims[index].chainID]++;
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.batchExecutionFailedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            queuedBatchExecutionFailedClaims[_claims.batchExecutionFailedClaims[index].observedTransactionHash] = _claims
                .batchExecutionFailedClaims[index];

            // queuedClaims[claimsCounter][ClaimTypes.BATCH_EXECUTION_FAILED][_claims.batchExecutionFailedClaims[index].chainID].push(
            //     _claims.batchExecutionFailedClaims[index].observedTransactionHash
            // );

            queuedClaims[_claims.batchExecutionFailedClaims[index].chainID][claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]] = _claims.batchExecutionFailedClaims[index].observedTransactionHash;

            claimsCounter[_claims.batchExecutionFailedClaims[index].chainID]++;
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.refundRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            queuedRefundRequestClaims[_claims.refundRequestClaims[index].observedTransactionHash] = _claims
                .refundRequestClaims[index];

            // queuedClaims[claimsCounter][ClaimTypes.REFUND_REQUEST][_claims.refundRequestClaims[index].chainID].push(
            //     _claims.refundRequestClaims[index].observedTransactionHash
            // );

            queuedClaims[_claims.refundRequestClaims[index].chainID][claimsCounter[_claims.refundRequestClaims[index].chainID]] = _claims.refundRequestClaims[index].observedTransactionHash;

            claimsCounter[_claims.refundRequestClaims[index].chainID]++;
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index) internal {
        voters[_claims.refundExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            queuedRefundExecutedClaims[_claims.refundExecutedClaims[index].observedTransactionHash] = _claims
                .refundExecutedClaims[index];

            // queuedClaims[claimsCounter][ClaimTypes.REFUND_EXECUTED][_claims.refundExecutedClaims[index].chainID].push(
            //     _claims.refundExecutedClaims[index].observedTransactionHash
            // );

             queuedClaims[_claims.refundExecutedClaims[index].chainID][claimsCounter[_claims.refundExecutedClaims[index].chainID]] = _claims.refundExecutedClaims[index].observedTransactionHash;

            claimsCounter[_claims.refundExecutedClaims[index].chainID]++;
        }
    }

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {}

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external override onlyOwner {
        registeredChains[_chainId] = true;
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;
        emit newChainRegistered(_chainId);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external onlyValidator {
        require(!registeredChains[_chainId], "Chain already registered");
        if (_hasVoted(_chainId)) {
                revert AlreadyProposed(_chainId);
            }
        _registerChainGovernance(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer);
    }

    function _registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) internal {
        voters[_chainId][msg.sender] = true;
        numberOfVotes[_chainId]++;
        if (_hasConsensus(_chainId)) {
            registeredChains[_chainId] = true;
            chains.push();
            chains[chains.length - 1].id = _chainId;
            chains[chains.length - 1].utxos = _initialUTXOs;
            chains[chains.length - 1].addressMultisig = _addressMultisig;
            chains[chains.length - 1].addressFeePayer = _addressFeePayer;
            emit newChainRegistered(_chainId);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external view override returns (bool batch) {

    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory confirmedTransactions) {}

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig address
    // that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external view override returns (UTXOs memory availableUTXOs) {}

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {}

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (string memory blockHash) {}

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function isChainRegistered(string calldata _chainId) external view override returns (bool) {
        return registeredChains[_chainId];
    }

    function getValidatorsCount() external view override returns (uint8) {
        return validatorsCount;
    }

    function getNumberOfVotes(string calldata _id) external view override returns (uint8) {
        return numberOfVotes[_id];
    }

    function getClaimsCounter(string calldata _chainId) external view returns (uint256) {
        return claimsCounter[_chainId];
    }

    function _hasVoted(string calldata _id) internal view returns (bool) {
        return voters[_id][msg.sender];
    }

    function isQueuedBRC(BridgingRequestClaim calldata _claim) external view returns (bool) {
        return _isQueuedBRC(_claim);
    }

    function _isQueuedBRC(BridgingRequestClaim calldata _claim) internal view returns (bool) {
        return
            keccak256(abi.encode(_claim)) ==
            keccak256(abi.encode(queuedBridgingRequestsClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEC(BatchExecutedClaim calldata _claim) external view returns (bool) {
        return _isQueuedBEC(_claim);
    }

    function _isQueuedBEC(BatchExecutedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) external view returns (bool) {
        return _isQueuedBEFC(_claim);
    }

    function _isQueuedBEFC(BatchExecutionFailedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutionFailedClaims[_claim.observedTransactionHash]));
    }

    function isQueuedRRC(RefundRequestClaim calldata _claim) external view returns (bool) {
        return _isQueuedRRC(_claim);
    }

    function _isQueuedRRC(RefundRequestClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundRequestClaims[_claim.observedTransactionHash]));
    }

    function isQueuedREC(RefundExecutedClaim calldata _claim) external view returns (bool) {
        return _isQueuedREC(_claim);
    }

    function _isQueuedREC(RefundExecutedClaim calldata _claim) internal view returns (bool) {
        return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedRefundExecutedClaims[_claim.observedTransactionHash]));     
    }

    function _hasConsensus(string calldata _id) internal view returns (bool) {
        if (numberOfVotes[_id] >= ((validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }

    modifier onlyValidator() {
        require(validators[msg.sender], "Not validator");
        _;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "Not owner");
        _;
    }


}