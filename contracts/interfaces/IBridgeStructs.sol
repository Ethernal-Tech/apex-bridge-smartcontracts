// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IBridgeStructs {
    struct SignedBatch {
        uint64 id;
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        uint8 destinationChainId;
        bytes multisigSignature;
        bytes feePayerMultisigSignature;
        bytes rawTransaction;
        UTXOs usedUTXOs;
    }

    struct SignedBatchWithoutSignatures {
        uint64 id;
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        uint8 destinationChainId;
        bytes rawTransaction;
        UTXO[] multisigOwnedUTXOs;
        UTXO[] feePayerOwnedUTXOs;
    }

    struct ConfirmedSignedBatchData {
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
    }

    struct ConfirmedBatch {
        bytes[] multisigSignatures;
        bytes[] feePayerMultisigSignatures;
        bytes rawTransaction;
        uint64 id;
    }

    struct ConfirmedTransaction {
        uint256 blockHeight;
        uint256 totalAmount;
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
        bytes32 txHash;
        uint64 txIndex;
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
        bytes multisigSignature;
        // the refund transaction itself
        bytes rawTransaction;
        // retry attempt counter
        uint64 retryCounter;
        // chain id where the refund tx will be executed
        uint8 chainId;
        string receiver;
    }

    struct RefundExecutedClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // hash of the refund transaction
        bytes32 refundTxHash;
        // chain id where the refund was executed
        uint8 chainId;
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
    error NotSignedBatchesOrClaims();
    error NotEnoughBridgingTokensAvailable(bytes32 _claimTransactionHash);
    error CanNotCreateBatchYet(uint8 _blockchainId);
    error InvalidData(string data);
    error ChainIsNotRegistered(uint8 _chainId);
    error WrongBatchNonce(uint8 _chainId, uint64 _nonce);
    error InvalidSignature();

    event newChainProposal(uint8 indexed _chainId, address indexed sender);
    event newChainRegistered(uint8 indexed _chainId);
}
