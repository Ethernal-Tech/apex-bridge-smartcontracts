// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IBridgeContractStructs {

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

    error AlreadyQueued(string _claimhash);
    error AlreadyProposed(string _claimhash);
    error ChainAlreadyRegistered();
    error NotOwner();
    error NotValidator();
    
    event newChainProposal(string indexed chainId, address indexed sender);
    event newChainRegistered(string indexed chainId);
    
}