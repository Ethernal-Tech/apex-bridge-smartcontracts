// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";
import "./Helpers.sol";
import "./BridgeContractClaims.sol";

contract BridgeContract is IBridgeContract, Helpers, BridgeContractClaims {
    // mapping in case they could be added/removed
    mapping(address => bool) private validators;
    mapping(string => bool) private registeredChains;

    // Blochchain ID -> claimsCounter
    mapping(string => uint64) private lastBatchedClaim;

    // Blochchain ID -> blockNumber
    mapping(string => uint64) private lastBatchBlock;

    // BatchId -> SignedBatch[]
    mapping(string => SignedBatch[]) private signedBatches;

    // BatchId -> ConfirmedBatch
    mapping(string => ConfirmedBatch) private confirmedBatches;

    Chain[] private chains;
    address private owner;
    uint16 private constant MAX_NUMBER_OF_TRANSACTIONS = 1; //intentially set low for testing
    uint8 private constant MAX_NUMBER_OF_BLOCKS = 5;

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

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {

        voters[_signedBatch.id][msg.sender] = true;
        numberOfVotes[_signedBatch.id]++;
        signedBatches[_signedBatch.id].push(_signedBatch);

        if (_hasConsensus(_signedBatch.id)) {
            string[] memory multisigSignatures;
            string[] memory feePayerMultisigSignatures;

            for (uint i = 0; i < signedBatches[_signedBatch.id].length; i++) {
                multisigSignatures[i] = signedBatches[_signedBatch.id][i].multisigSignature;
                feePayerMultisigSignatures[i] = signedBatches[_signedBatch.id][i].feePayerMultisigSignature;
            }

            ConfirmedBatch memory confirmedBatch = ConfirmedBatch(
                _signedBatch.id,
                _signedBatch.rawTransaction,
                multisigSignatures,
                feePayerMultisigSignatures
            );
            
            confirmedBatches[_signedBatch.id] = confirmedBatch;
        }
    }

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
        //TO DO: implement second sentence of comment, once we have batches, we can check if the validator already submitted 
        //this batch or should he do it now
        if ((claimsCounter[_destinationChain] - lastBatchedClaim[_destinationChain]) >= MAX_NUMBER_OF_TRANSACTIONS) {
            return true;
        }
        if ((block.number - lastBatchBlock[_destinationChain]) >= MAX_NUMBER_OF_BLOCKS) {
            return true;
        }
        return false;
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
    ) external view override returns (ConfirmedBatch memory batch) {
        // return confirmedBatches[_destinationChain];
    }

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (string memory blockHash) {
        return lastObserverdBlock[_sourceChain];
    }

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

    function getSignedBatches(string calldata _id) external view onlyValidator returns (SignedBatch[] memory) {
        return signedBatches[_id];
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