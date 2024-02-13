// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

abstract contract IBridgeContract {

    enum ClaimTypes {
        BRIDGING_REQUEST,
        BATCH_EXECUTED,
        BATCH_EXECUTION_FAILED,
        REFUND_REQUEST,
        REFUND_EXECUTED
    }
    
     // Claims
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    // Chain registration through some kind of governance
    function registerChain(string calldata _chainId, UTXOs calldata _initialUTXOs, string calldata _addressMultisig, string calldata _addressFeePayer) external virtual;

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external virtual view returns (bool batch);

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that 
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(string calldata _destinationChain) 
        external virtual view returns (ConfirmedTransaction[] memory confirmedTransactions);

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens 
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and 
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig address 
    // that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer 
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(string calldata _destinationChain, uint256 txCost) 
        external virtual view returns (UTXOs memory availableUTXOs);

    function getConfirmedBatch(string calldata _destinationChain) external virtual view returns (ConfirmedBatch memory batch);

    function getLastObservedBlock(string calldata _sourceChain) external virtual view returns (string memory blockHash);

    function getAllRegisteredChains() external virtual view returns (Chain[] memory _chains);

    function isChainRegistered(string calldata _chainId) external virtual view returns (bool);

    function getValidatorsCount() external virtual view returns (uint8);

    function getNumberOfVotes(string calldata _id) external virtual view returns (uint8);

    struct SignedBatch {
        string id;
        string destinationChainId;
        string rawTransaction;
        string multisigSignature;
        string feePayerMultisigSignature;

        ConfirmedTransaction[] includedTransactions;
        UTXOs usedUTXOs;
    }

    struct ConfirmedBatch {
        string id;
        string rawTransaction;
        string[] multisigSignatures;
        string[] feePayerMultisigSignatures;
    }

    struct ConfirmedTransaction {
        uint256 nonce;
        //mapping(string => uint256) receivers;
        Receiver[] receivers;
    }

    struct UTXOs {
        UTXO[] multisigOwnedUTXOs;
        UTXO[] feePayerOwnedUTXOs;
    }

    struct UTXO {
        string txHash;
        uint256 txIndex;
        string  addressUTXO; // TODO: do we need this? I think we do
        uint256 amount;
    }

    struct ValidatorClaims {
        BridgingRequestClaim[] bridgingRequestClaims;
        BatchExecutedClaim[] batchExecutedClaims;
        BatchExecutionFailedClaim[] batchExecutionFailedClaims;
        RefundRequestClaim[] refundRequestClaims;
        RefundExecutedClaim[] refundExecutedClaims;
        
        string blockHash;
        bool blockFullyObserved;
    }

    struct BridgingRequestClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // key is the address on destination UTXO chain; value is the amount of tokens
        Receiver[] receivers;
        UTXO outputUTXO;
        string sourceChainID;
        string destinationChainID;
    }

    struct BatchExecutedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // where the batch was executed
        string chainID;
        uint256 batchNonceID;
        UTXOs outputUTXOs;
    }

    struct BatchExecutionFailedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // where the batch execution failed
        string chainID;
        uint256 batchNonceID;
    }

    struct RefundRequestClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // hash of the previous refund transaction; only set in case of retry
        string previousRefundTxHash;
        // chain id where the refund tx will be executed
        string chainID;
        string receiver;
        // UTXO that multisig received in invalid transaction
        UTXO utxo;
        // the refund transaction itself
        string rawTransaction;
        // validators signature over raw transaction
        // note: only multisig signs refund txs
        string multisigSignature;
        // retry attempt counter
        uint256 retryCounter;
    }

    struct RefundExecutedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // chain id where the refund was executed
        string chainID;
        // hash of the refund transaction
        string refundTxHash;
        // UTXO that multisig received as change after paying network fee
        UTXO utxo;
    }

    struct Receiver {
        string destinationAddress;
        uint256 amount;
    }

    struct Chain {
        string id;
        UTXOs utxos;
        string addressMultisig;
        string addressFeePayer;
    }
    
    event newChainProposal(string indexed chainId, address indexed sender);
    event newChainRegistered(string indexed chainId);
}