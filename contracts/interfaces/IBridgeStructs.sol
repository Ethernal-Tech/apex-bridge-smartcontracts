// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IBridgeStructs {
    struct SignedBatch {
        uint64 id;
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        uint8 destinationChainId;
        bytes32 multisigSignature;
        bytes32 feePayerMultisigSignature;
        string rawTransaction;
        UTXOs usedUTXOs;
    }

    struct SignedBatchWithoutSignatures {
        uint64 id;
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        uint8 destinationChainId;
        string rawTransaction;
        UTXOs usedUTXOs;
    }

    struct ConfirmedSignedBatchData {
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        UTXOs usedUTXOs;
    }

    struct ConfirmedBatch {
        bytes32[] multisigSignatures;
        bytes32[] feePayerMultisigSignatures;
        uint64 id;
        string rawTransaction;
    }

    struct ConfirmedTransaction {
        uint256 blockHeight;
        uint64 nonce;
        uint8 sourceChainId;
        bytes32 observedTransactionHash;
        Receiver[] receivers;
    }

    struct UTXOs {
        UTXO[] multisigOwnedUTXOs;
        UTXO[] feePayerOwnedUTXOs;
    }

    struct UTXO {
        uint64 nonce; // this is set by smart contract - order of confirmed UTXOs
        uint64 txIndex;
        uint64 amount;
        bytes32 txHash;
    }

    struct CardanoBlock {
        uint256 blockSlot;
        bytes32 blockHash;
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
        bytes32 observedTransactionHash;
        // key is the address on destination UTXO chain; value is the amount of tokens
        Receiver[] receivers;
        UTXO outputUTXO;
        uint256 totalAmount;
        uint8 sourceChainId;
        uint8 destinationChainId;
    }

    struct BatchExecutedClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        uint64 batchNonceId;
        // where the batch was executed
        uint8 chainId;
        UTXOs outputUTXOs;
    }

    struct BatchExecutionFailedClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // where the batch execution failed
        uint64 batchNonceId;
        uint8 chainId;
    }

    struct RefundRequestClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // hash of the previous refund transaction; only set in case of retry
        bytes32 previousRefundTxHash;
        // validatorsArray signature over raw transaction
        // note: only multisig signs refund txs
        bytes32 multisigSignature;
        // retry attempt counter
        uint64 retryCounter;
        // chain id where the refund tx will be executed
        uint8 chainId;
        string receiver;
        // the refund transaction itself
        string rawTransaction;
        // UTXO that multisig received in invalid transaction
        UTXO utxo;
    }

    struct RefundExecutedClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // hash of the refund transaction
        bytes32 refundTxHash;
        // chain id where the refund was executed
        uint8 chainId;
        // UTXO that multisig received as change after paying network fee
        UTXO utxo;
    }

    struct Receiver {
        uint64 amount;
        string destinationAddress;
    }

    struct Chain {
        uint8 id;
        string addressMultisig;
        string addressFeePayer;
    }

    struct LastObservedBlockInfo {
        bytes32 blockHash;
        uint256 slot;
    }

    struct ValidatorAddressCardanoData {
        address addr;
        ValidatorCardanoData data;
    }

    struct ValidatorCardanoData {
        bytes32 verifyingKey;
        bytes32 verifyingKeyFee;
    }

    error AlreadyConfirmed(bytes32 _claimTransactionHash);
    error AlreadyProposed(uint8 _claimTransactionHash);
    error ChainAlreadyRegistered(uint8 _chainId);
    error NotOwner();
    error NotValidator();
    error NotBridge();
    error NotClaims();
    error NotSignedBatches();
    error NotSignedBatchesOrBridge();
    error NotEnoughBridgingTokensAvailable(bytes32 _claimTransactionHash);
    error CanNotCreateBatchYet(uint8 _blockchainId);
    error InvalidData(string data);
    error ChainIsNotRegistered(uint8 _chainId);
    error WrongBatchNonce(uint8 _chainId, uint64 _nonce);
    error InvalidSignature();

    event newChainProposal(uint8 indexed _chainId, address indexed sender);
    event newChainRegistered(uint8 indexed _chainId);
}
