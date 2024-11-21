// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IBridgeStructs {
    struct SignedBatch {
        uint64 id;
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        uint8 destinationChainId;
        bytes signature;
        bytes feeSignature;
        bytes rawTransaction;
    }

    struct ConfirmedSignedBatchData {
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
    }

    struct ConfirmedBatch {
        bytes[] signatures;
        bytes[] feeSignatures;
        uint256 bitmap;
        bytes rawTransaction;
        uint64 id;
    }

    struct ConfirmedTransaction {
        uint256 blockHeight;
        uint256 totalAmount;
        uint256 retryCounter;
        uint64 nonce;
        uint8 sourceChainId;
        bytes32 observedTransactionHash;
        uint8 transactionType; // 0 = normal, 1 = defund, 2 = refund
        Receiver[] receivers;
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
        HotWalletIncrementClaim[] hotWalletIncrementClaims;
    }

    struct BridgingRequestClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // key is the address on destination UTXO chain; value is the amount of tokens
        Receiver[] receivers;
        uint256 totalAmount;
        uint256 retryCounter;
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
        // the refund transaction itself
        bytes rawTransaction;
        // chain id where the refund tx will be executed
        uint256 retryCounter;
        uint8 chainId;
        Receiver[] receivers;
    }

    struct HotWalletIncrementClaim {
        uint8 chainId;
        uint256 amount;
        bool isIncrement;
    }

    struct Receiver {
        uint256 amount;
        string destinationAddress;
    }

    struct Chain {
        uint8 id;
        uint8 chainType;
        string addressMultisig;
        string addressFeePayer;
    }

    struct ValidatorAddressChainData {
        address addr;
        ValidatorChainData data;
    }

    struct ValidatorChainData {
        // verifying key, verifying Fee key for Cardano
        // BLS for EVM
        uint256[4] key;
    }

    struct TxDataInfo {
        uint8 sourceChainId;
        bytes32 observedTransactionHash;
    }

    error AlreadyConfirmed(bytes32 _claimTransactionHash);
    error AlreadyProposed(uint8 _claimTransactionHash);
    error ChainAlreadyRegistered(uint8 _chainId);
    error NotOwner();
    error NotValidator();
    error NotBridge();
    error NotClaims();
    error NotSignedBatches();
    error NotFundAdmin();
    error NotAdminContract();
    error NotSignedBatchesOrBridge();
    error NotSignedBatchesOrClaims();
    error NotEnoughBridgingTokensAvailable(bytes32 _claimTransactionHash);
    error CanNotCreateBatchYet(uint8 _chainId);
    error InvalidData(string data);
    error ChainIsNotRegistered(uint8 _chainId);
    error WrongBatchNonce(uint8 _chainId, uint64 _nonce);
    error InvalidSignature();
    error DefundRequestTooHigh(uint8 _chainId, uint256 _availableAmount, uint256 _requestedAmount);
    error ZeroAddress();
    error NegativeChainTokenAmount(uint256 _availableAmount, uint256 _decreaseAmount);

    event newChainProposal(uint8 indexed _chainId, address indexed sender);
    event newChainRegistered(uint8 indexed _chainId);
    event NotEnoughFunds(string claimeType, uint256 index, uint256 availableAmount);
    event InsufficientFunds(uint256 availableAmount, uint256 withdrawalAmount);
    event ChainDefunded(uint8 _chainId, uint256 _amount);
    event FundAdminChanged(address _newFundAdmin);
    event UpdatedChainTokenQuantity(uint indexed chainId, bool isIncrement, uint256 tokenQuantity);
    event DefundFailedAfterMultipleRetries();
}
