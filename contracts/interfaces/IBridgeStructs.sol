// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBridgeStructs
/// @notice Data structure definitions, custom errors, and events used by the IBridge interface
interface IBridgeStructs {
    /// @notice Represents a signed batch to be executed on a destination chain.
    struct SignedBatch {
        uint64 id;
        uint64 firstTxNonceId; // does not matter if isConsolidation is true
        uint64 lastTxNonceId; // does not matter if isConsolidation is true
        uint8 destinationChainId;
        bytes signature;
        bytes feeSignature;
        bytes rawTransaction;
        bool isConsolidation;
    }

    /// @notice Metadata for a batch that has been confirmed.
    struct ConfirmedSignedBatchData {
        uint64 firstTxNonceId;
        uint64 lastTxNonceId;
        bool isConsolidation;
        uint8 status; // 0 = deleted, 1 = in progress, 2 = executed, 3 = failed
    }

    /// @notice Data for a confirmed batch that was executed on-chain.
    struct ConfirmedBatch {
        bytes[] signatures;
        bytes[] feeSignatures;
        uint256 bitmap;
        bytes rawTransaction;
        uint64 id;
        bool isConsolidation;
    }

    /// @notice A transaction that has been confirmed and is ready for batching.
    struct ConfirmedTransaction {
        uint256 blockHeight;
        uint256 totalAmount;
        uint256 retryCounter;
        bytes32 observedTransactionHash;
        uint64 nonce;
        uint8 sourceChainId;
        uint8 transactionType; // 0 = normal, 1 = defund, 2 = refund, 3 = special
        bool alreadyTriedBatch;
        Receiver[] receivers;
        bytes outputIndexes;
    }

    /// @notice Represents a block from the Cardano chain.
    struct CardanoBlock {
        uint256 blockSlot;
        bytes32 blockHash;
    }

    /// @notice Collection of claims submitted by validators.
    struct ValidatorClaims {
        BridgingRequestClaim[] bridgingRequestClaims;
        BatchExecutedClaim[] batchExecutedClaims;
        BatchExecutionFailedClaim[] batchExecutionFailedClaims;
        RefundRequestClaim[] refundRequestClaims;
        HotWalletIncrementClaim[] hotWalletIncrementClaims;
    }

    /// @notice A claim that a bridging request was observed on the source chain.
    struct BridgingRequestClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // key is the address on destination UTXO chain; value is the amount of tokens
        Receiver[] receivers;
        uint256 totalAmountSrc;
        uint256 totalAmountDst;
        uint256 retryCounter;
        uint8 sourceChainId;
        uint8 destinationChainId;
    }

    /// @notice A claim that a batch was executed on a specific chain.
    struct BatchExecutedClaim {
        // hash of tx where batch was executed
        bytes32 observedTransactionHash;
        uint64 batchNonceId;
        // where the batch was executed
        uint8 chainId;
    }

    /// @notice A claim that a batch execution failed on a specific chain.
    struct BatchExecutionFailedClaim {
        // hash of tx on the source chain
        bytes32 observedTransactionHash;
        // where the batch execution failed
        uint64 batchNonceId;
        // chain id where the refund was executed
        uint8 chainId;
    }

    /// @notice A request to refund a failed bridging transaction.
    struct RefundRequestClaim {
        // Hash of the original transaction on the source chain
        bytes32 originTransactionHash;
        // Hash of the manual refund request tx - will not be used in the first version
        bytes32 refundTransactionHash;
        // Amount of tokens deposited to the multisig address in original transaction
        uint256 originAmount;
        // serialized uint16 list of indexes of all multisig outputs that contain unknown native tokens
        bytes outputIndexes;
        // Address of the user who sent the original transaction (tx inputs)
        // If there are multiple input addresses, only one should be picked (by some algorithm)
        string originSenderAddress;
        // Number of times the refund transaction has been attempted on-chain
        uint64 retryCounter;
        // ID of the chain where the refund will be executed (or the original source chain)
        uint8 originChainId;
        // will be false if refund is requested because of invalid metadata or
        // bridging request claim was never submitted (NotEnoughFunds)
        bool shouldDecrementHotWallet;
    }

    /// @notice A claim to increase the balance of a chain's hot wallet.
    struct HotWalletIncrementClaim {
        uint8 chainId;
        uint256 amount;
    }

    /// @notice Destination address and amount for a transaction output.
    struct Receiver {
        uint256 amount;
        string destinationAddress;
    }

    /// @notice Metadata about a chain registered with the bridge.
    struct Chain {
        uint8 id;
        uint8 chainType;
        string addressMultisig;
        string addressFeePayer;
    }

    /// @notice Added and removed validators for a new validator set.
    struct NewValidatorSetDelta {
        ValidatorSet[] addedValidators;
        address[] removedValidators;
    }

    /// @notice Full data for new Validator Set.
    struct ValidatorSet {
        uint8 chainId;
        ValidatorAddressChainData[] validators;
    }

    /// @notice Data for a validator address and its signing keys.
    struct ValidatorAddressChainData {
        address addr;
        ValidatorChainData data;
        bytes keySignature;
        bytes keyFeeSignature;
    }

    /// @notice Validator public key data for either Cardano or EVM (e.g., BLS).
    struct ValidatorChainData {
        uint256[4] key;
    }

    /// @notice Summary info for a transaction in a batch.
    struct TxDataInfo {
        bytes32 observedTransactionHash;
        uint8 sourceChainId;
        uint8 transactionType;
    }

    /// @notice Containts bitmap representing validator participation and signatures (one per voting validator)
    struct SignedBatchVotesInfo {
        uint256 bitmap;
        bytes[] signatures;
        bytes[] feeSignatures;
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------
    error AlreadyProposed(uint8 _claimTransactionHash);
    error ChainAlreadyRegistered(uint8 _chainId);
    error NotOwner();
    error NotValidator();
    error NotBridge();
    error NotClaims();
    error NotSignedBatches();
    error NotFundAdmin();
    error NotUpgradeAdmin();
    error NotAdminContract();
    error CanNotCreateBatchYet(uint8 _chainId);
    error InvalidData(string data);
    error ChainIsNotRegistered(uint8 _chainId);
    error InvalidSignature();
    error DefundRequestTooHigh(uint8 _chainId, uint256 _availableAmount, uint256 _requestedAmount);
    error ZeroAddress();
    error NegativeChainTokenAmount(uint256 _availableAmount, uint256 _decreaseAmount);
    error TooManyReceivers(uint256 _receiversCount, uint256 _maxReceiversCount);
    error TooManyBlocks(uint256 _blocksCount, uint256 _maxBlocksCount);
    error TooManyClaims(uint256 _claimsCount, uint256 _maxClaimsCount);
    error NotContractAddress();
    error NewValidatorSetAlreadyPending();
    error NoNewValidatorSetPending();
    error NotSpecialClaimsOrSpecialSignedBatches();
    error NotSpecialSignedBatches();
    error WrongSpecialClaims();
    error NotSignedBatchesOrClaimsorSpecialClaims();
    error NotSpecialClaims();
    error NotSystem();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event newChainProposal(uint8 indexed _chainId, address indexed sender);
    event newChainRegistered(uint8 indexed _chainId);
    event NotEnoughFunds(string claimeType, uint256 index, uint256 availableAmount);
    event ChainDefunded(uint8 _chainId, uint256 _amount);
    event FundAdminChanged(address _newFundAdmin);
    event UpdatedChainTokenQuantity(uint indexed chainId, bool isIncrement, uint256 tokenQuantity);
    event DefundFailedAfterMultipleRetries();
    event UpdatedMaxNumberOfTransactions(uint256 _maxNumberOfTransactions);
    event UpdatedTimeoutBlocksNumber(uint256 _timeoutBlocksNumber);
    event newValidatorSetSubmitted();
    event SpecialSignedBatchExecutionFailed(uint8 indexed chainId, uint64 indexed batchId);
}
