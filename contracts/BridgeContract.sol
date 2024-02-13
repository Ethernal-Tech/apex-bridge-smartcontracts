// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";

contract BridgeContract is IBridgeContract {
    mapping(address => bool) private validators; // mapping in case they could be added/removed
    mapping(string => bool) private registeredChains;

    //mapping(string => address[]) private voters;
    mapping(string => mapping(address => bool)) private voters;
    mapping(string => uint8) private numberOfVotes;

    mapping(string => BridgingRequestClaim) private queuedBridgingRequestsClaims;
    mapping(string => BatchExecutedClaim) private queuedBatchExecutedClaims;
    mapping(string => BatchExecutionFailedClaim) private queuedBatchExecutionFailedClaims;
    mapping(string => RefundRequestClaim) private queuedRefundRequestClaims;
    mapping(string => RefundExecutedClaim) private queuedRefundExecutedClaims;

    // claim_type, chain, hash -> claim_object is missing because we do not have claim struct
    // by implementing "universal" claim struct we could have "universal" mapping
    // and would not need to have separate mapping for each claim type
    // map[claim_type]map[chain]map[hash]claim_object
    mapping(ClaimTypes => mapping(string => string[])) private queuedClaims;

    Chain[] private chains;
    uint8 private validatorsCount;

    constructor(address[] memory _validators) {
        for (uint i = 0; i < _validators.length; i++) {
            validators[_validators[i]] = true;
        }
        validatorsCount = uint8(_validators.length);
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            require(!_isQueuedBRC(_claims.bridgingRequestClaims[i]), "Already queued");
            require(!_hasVoted(_claims.bridgingRequestClaims[i].observedTransactionHash), "Already proposed");
            _submitClaimsBRC(_claims, i);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            require(!_isQueuedBEC(_claims.batchExecutedClaims[i]), "Already queued");
            require(!_hasVoted(_claims.batchExecutedClaims[i].observedTransactionHash), "Already proposed");
            _submitClaimsBEC(_claims, i);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            require(!_isQueuedBEFC(_claims.batchExecutionFailedClaims[i]), "Already queued");
            require(!_hasVoted(_claims.batchExecutionFailedClaims[i].observedTransactionHash), "Already proposed");
            _submitClaimsBEFC(_claims, i);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            require(!_isQueuedRRC(_claims.refundRequestClaims[i]), "Already queued");
            require(!_hasVoted(_claims.refundRequestClaims[i].observedTransactionHash), "Already proposed");
            _submitClaimsRRC(_claims, i);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            require(!_isQueuedREC(_claims.refundExecutedClaims[i]), "Already queued");
            require(!_hasVoted(_claims.refundExecutedClaims[i].observedTransactionHash), "Already proposed");
            _submitClaimsREC(_claims, i);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index) internal {
        //voters[_claims.bridgingRequestClaims[index].observedTransactionHash].push(msg.sender);
        voters[_claims.bridgingRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.bridgingRequestClaims[index].observedTransactionHash)) {
            queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash] = _claims
                .bridgingRequestClaims[index];

            queuedClaims[ClaimTypes.BRIDGING_REQUEST][_claims.bridgingRequestClaims[index].sourceChainID].push(
                _claims.bridgingRequestClaims[index].observedTransactionHash
            );
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index) internal {
        //voters[_claims.batchExecutedClaims[index].observedTransactionHash].push(msg.sender);
        voters[_claims.batchExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutedClaims[index].observedTransactionHash)) {
            queuedBatchExecutedClaims[_claims.batchExecutedClaims[index].observedTransactionHash] = _claims
                .batchExecutedClaims[index];

            queuedClaims[ClaimTypes.BATCH_EXECUTED][_claims.batchExecutedClaims[index].chainID].push(
                _claims.batchExecutedClaims[index].observedTransactionHash
            );
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index) internal {
        //voters[_claims.batchExecutionFailedClaims[index].observedTransactionHash].push(msg.sender);
        voters[_claims.batchExecutionFailedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.batchExecutionFailedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.batchExecutionFailedClaims[index].observedTransactionHash)) {
            queuedBatchExecutionFailedClaims[_claims.batchExecutionFailedClaims[index].observedTransactionHash] = _claims
                .batchExecutionFailedClaims[index];

            queuedClaims[ClaimTypes.BATCH_EXECUTION_FAILED][_claims.batchExecutionFailedClaims[index].chainID].push(
                _claims.batchExecutionFailedClaims[index].observedTransactionHash
            );
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index) internal {
        //voters[_claims.refundRequestClaims[index].observedTransactionHash].push(msg.sender);
        voters[_claims.refundRequestClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundRequestClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundRequestClaims[index].observedTransactionHash)) {
            queuedRefundRequestClaims[_claims.refundRequestClaims[index].observedTransactionHash] = _claims
                .refundRequestClaims[index];

            queuedClaims[ClaimTypes.REFUND_REQUEST][_claims.refundRequestClaims[index].chainID].push(
                _claims.refundRequestClaims[index].observedTransactionHash
            );
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index) internal {
        //voters[_claims.refundExecutedClaims[index].observedTransactionHash].push(msg.sender);
        voters[_claims.refundExecutedClaims[index].observedTransactionHash][msg.sender] = true;
        numberOfVotes[_claims.refundExecutedClaims[index].observedTransactionHash]++;

        if (_hasConsensus(_claims.refundExecutedClaims[index].observedTransactionHash)) {
            queuedRefundExecutedClaims[_claims.refundExecutedClaims[index].observedTransactionHash] = _claims
                .refundExecutedClaims[index];

            queuedClaims[ClaimTypes.REFUND_EXECUTED][_claims.refundExecutedClaims[index].chainID].push(
                _claims.refundExecutedClaims[index].observedTransactionHash
            );
        }
    }

    // // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {}

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external override onlyValidator {
        require(!registeredChains[_chainId], "Chain already registered");
        require(!_hasVoted(_chainId), "Already proposed");
        _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer);
    }

    function _registerChain(
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
        }
        emit newChainProposal(_chainId, msg.sender);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external view override returns (bool batch) {}

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

    //could be renamed to work with all voting types
    function getNumberOfVotes(string calldata _id) external view override returns (uint8) {
        return numberOfVotes[_id];
    }

    function _hasVoted(string calldata _id) internal view returns (bool) {
        // for (uint i = 0; i < voters[_id].length; i++) {
        //     if (voters[_id][i] == msg.sender) {
        //         return true;
        //     }
        // }
        // return false;
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

    // only allowed for validators
    modifier onlyValidator() {
        require(validators[msg.sender], "Not validator");
        _;
    }
}