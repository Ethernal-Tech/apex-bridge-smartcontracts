// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IBridgeStructs {
    struct SignedBatch {
        uint256 id;
        uint8 destinationChainId;
        string rawTransaction;
        string multisigSignature;
        string feePayerMultisigSignature;
        uint256 firstTxNonceId;
        uint256 lastTxNonceId;
        UTXOs usedUTXOs;
    }

    struct SignedBatchWithoutSignatures {
        uint256 id;
        uint8 destinationChainId;
        string rawTransaction;
        uint256 firstTxNonceId;
        uint256 lastTxNonceId;
        UTXOs usedUTXOs;
    }

    struct ConfirmedSignedBatchData {
        uint256 firstTxNonceId;
        uint256 lastTxNonceId;
        UTXOs usedUTXOs;
    }

    struct ConfirmedBatch {
        uint256 id;
        string rawTransaction;
        string[] multisigSignatures;
        string[] feePayerMultisigSignatures;
    }

    struct ConfirmedTransaction {
        string observedTransactionHash;
        uint256 nonce;
        uint256 blockHeight;
        uint8 sourceChainId;
        Receiver[] receivers;
    }

    struct UTXOs {
        UTXO[] multisigOwnedUTXOs;
        UTXO[] feePayerOwnedUTXOs;
    }

    struct UTXO {
        uint64 nonce; // this is set by smart contract - order of confirmed UTXOs
        string txHash;
        uint256 txIndex;
        uint256 amount;
    }

    struct CardanoBlock {
        string blockHash;
        uint64 blockSlot;
    }

    struct ValidatorClaims {
        BridgingRequestClaim[] bridgingRequestClaims;
        BatchExecutedClaim[] batchExecutedClaims;
        BatchExecutionFailedClaim[] batchExecutionFailedClaims;
        RefundRequestClaim[] refundRequestClaims;
        RefundExecutedClaim[] refundExecutedClaims;
    }

    struct BridgingRequestClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // key is the address on destination UTXO chain; value is the amount of tokens
        Receiver[] receivers;
        UTXO outputUTXO;
        uint8 sourceChainId;
        uint8 destinationChainId;
    }

    struct BatchExecutedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // where the batch was executed
        uint8 chainId;
        uint256 batchNonceId;
        UTXOs outputUTXOs;
    }

    struct BatchExecutionFailedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // where the batch execution failed
        uint8 chainId;
        uint256 batchNonceId;
    }

    struct RefundRequestClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // hash of the previous refund transaction; only set in case of retry
        string previousRefundTxHash;
        // chain id where the refund tx will be executed
        uint8 chainId;
        string receiver;
        // UTXO that multisig received in invalid transaction
        UTXO utxo;
        // the refund transaction itself
        string rawTransaction;
        // validatorsArray signature over raw transaction
        // note: only multisig signs refund txs
        string multisigSignature;
        // retry attempt counter
        uint256 retryCounter;
    }

    struct RefundExecutedClaim {
        // hash of tx on the source chain
        string observedTransactionHash;
        // chain id where the refund was executed
        uint8 chainId;
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
        uint8 id;
        string addressMultisig;
        string addressFeePayer;
    }

    struct LastObservedBlockInfo {
        string blockHash;
        uint256 slot;
    }

    struct ValidatorAddressCardanoData {
        address addr;
        ValidatorCardanoData data;
    }

    struct ValidatorCardanoData {
        string verifyingKey;
        string verifyingKeyFee;
    }

    error AlreadyConfirmed(string _claimTransactionHash);
    error AlreadyProposed(string _claimTransactionHash);
    error ChainAlreadyRegistered(uint8 _chainId);
    error NotOwner();
    error NotValidator();
    error NotBridge();
    error NotClaims();
    error NotSignedBatches();
    error NotSignedBatchesOrBridge();
    error NotEnoughBridgingTokensAvailable(string _claimTransactionHash);
    error CanNotCreateBatchYet(uint8 _blockchainId);
    error InvalidData(string data);
    error ChainIsNotRegistered(uint8 _chainId);
    error WrongBatchNonce(uint8 _chainId, uint256 _nonce);
    error InvalidSignature();

    event newChainProposal(uint8 indexed _chainId, address indexed sender);
    event newChainRegistered(uint8 indexed _chainId);
}
