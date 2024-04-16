// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IBridgeContractStructs {
    struct SignedBatch {
        uint256 id;
        string destinationChainId;
        string rawTransaction;
        string multisigSignature;
        string feePayerMultisigSignature;
        uint256[] includedTransactions;
        UTXOs usedUTXOs;
    }

    struct SignedBatchWithoutSignatures {
        uint256 id;
        string destinationChainId;
        string rawTransaction;
        uint256[] includedTransactions;
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
        uint256 tokenQuantity;
    }

    struct ChainWithoutSignatures {
        string id;
        UTXOs utxos;
        string addressMultisig;
        string addressFeePayer;
        uint256 tokenQuantity;
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
    error ChainAlreadyRegistered(string _claimId);
    error NotOwner();
    error NotValidator();
    error NotBridgeContract();
    error NotClaimsManager();
    error NotSignedBatchManager();
    error NotSignedBatchManagerOrBridgeContract();
    error NotEnoughBridgingTokensAwailable(string _claimTransactionHash);
    error CanNotCreateBatchYet(string _blockchainID);
    error InvalidData(string data);
    error ChainIsNotRegistered(string _chainId);
    error WrongBatchNonce(string _chainId, uint256 _nonce);
    error InvalidSignature();

    event newChainProposal(string indexed chainId, address indexed sender);
    event newChainRegistered(string indexed chainId);
}
