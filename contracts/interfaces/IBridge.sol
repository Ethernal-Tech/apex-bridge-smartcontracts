// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IBridgeStructs.sol";

/// @title IBridge
/// @notice Interface for cross-chain bridge functions supporting claims, batch submission, chain registration, and queries.
abstract contract IBridge is IBridgeStructs {
    /// @notice Submit claims from validators for reaching consensus.
    /// @param _claims The claims submitted by a validator.
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    /// @notice Submit a signed transaction batch for the Cardano chain.
    /// @param _signedBatch The batch of signed transactions.
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    /// @notice Submit a signed transaction batch for an EVM-compatible chain.
    /// @param _signedBatch The batch of signed transactions.
    function submitSignedBatchEVM(SignedBatch calldata _signedBatch) external virtual;

    /// @notice Submit the last observed Cardano blocks from validators for synchronization purposes.
    /// @param chainId The source chain ID.
    /// @param blocks Array of Cardano blocks to be recorded.
    function submitLastObservedBlocks(uint8 chainId, CardanoBlock[] calldata blocks) external virtual;

    /// @notice Set additional metadata for a chain, such as multisig and fee payer addresses.
    /// @param _chainId The target chain ID.
    /// @param addressMultisig Multisig address associated with the chain.
    /// @param addressFeePayer Fee payer address used for covering transaction costs.
    function setChainAdditionalData(
        uint8 _chainId,
        string calldata addressMultisig,
        string calldata addressFeePayer
    ) external virtual;

    /// @notice Register a new chain and its validator data.
    /// @param _chain Metadata and configuration of the new chain.
    /// @param _tokenQuantity Initial token allocation.
    /// @param _validatorData Validator data specific to this chain.
    function registerChain(
        Chain calldata _chain,
        uint256 _tokenQuantity,
        uint256 _wrappedTokenQuantity,
        ValidatorAddressChainData[] calldata _validatorData
    ) external virtual;

    /// @notice Register a new chain using governance.
    /// @param _chainId The ID of the new chain.
    /// @param _chainType The type of the chain (e.g., EVM, Cardano).
    /// @param _tokenQuantity Initial token allocation.
    /// @param _validatorChainData Validator data specific to the chain.
    /// @param _keySignature Signature from validator authorizing key usage.
    /// @param _keyFeeSignature Signature from validator authorizing fee keys.
    function registerChainGovernance(
        uint8 _chainId,
        uint8 _chainType,
        uint256 _tokenQuantity,
        uint256 _wrappedTokenQuantity,
        ValidatorChainData calldata _validatorChainData,
        bytes calldata _keySignature,
        bytes calldata _keyFeeSignature
    ) external virtual;

    /// @notice Check if a batch should be created for the destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _shouldCreateBatch Returns true if a batch should be created.
    function shouldCreateBatch(uint8 _destinationChain) external view virtual returns (bool _shouldCreateBatch);

    /// @notice Get the next batch ID if a batch should be created, or 0 if not.
    /// @param _destinationChain ID of the destination chain.
    /// @return _result ID of the next batch or 0 if no batch should be created.
    function getNextBatchId(uint8 _destinationChain) external view virtual returns (uint64 _result);

    /// @notice Get confirmed transactions ready for batching for a specific destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _confirmedTransactions Array of confirmed transactions.
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view virtual returns (ConfirmedTransaction[] memory _confirmedTransactions);

    /// @notice Returns the number of bridging addresses for a given chain.
    /// @param chainId The ID of the chain to query.
    /// @return The total count of bridging addresses for the specified chain.
    function getBridgingAddressesCount(uint8 chainId) external view virtual returns (uint8);

    /// @notice Returns the number of stake bridging addresses for a given chain.
    /// @param chainId The ID of the chain to query.
    /// @return The total count of stake bridging addresses for the specified chain.
    function getStakeBridgingAddressesCount(uint8 chainId) external view virtual returns (uint8);

    /// @notice Get the confirmed batch for the given destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _batch The confirmed batch details.
    function getConfirmedBatch(uint8 _destinationChain) external view virtual returns (ConfirmedBatch memory _batch);

    /// @notice Retrieve validator chain-specific data for a given chain ID.
    /// @param _chainId ID of the chain.
    /// @return Array of validator data.
    function getValidatorsChainData(uint8 _chainId) external view virtual returns (ValidatorChainData[] memory);

    /// @notice Get the last observed block for a given source chain.
    /// @param _sourceChain ID of the source chain.
    /// @return _cblock The last observed Cardano block.
    function getLastObservedBlock(uint8 _sourceChain) external view virtual returns (CardanoBlock memory _cblock);

    /// @notice Return a list of all chains currently registered with the bridge.
    /// @return _chains Array of registered chain data.
    function getAllRegisteredChains() external view virtual returns (Chain[] memory _chains);

    /// @notice Get raw transaction data from the most recent batch for a given destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return Raw bytes of the transaction data.
    function getRawTransactionFromLastBatch(uint8 _destinationChain) external view virtual returns (bytes memory);

    /// @notice Get transactions included in a specific batch for a given chain.
    /// @param _chainId ID of the chain.
    /// @param _batchId ID of the batch.
    /// @return status Status of the batch.
    /// @return txs Array of transaction data included in the batch.
    function getBatchStatusAndTransactions(
        uint8 _chainId,
        uint64 _batchId
    ) external virtual returns (uint8 status, TxDataInfo[] memory txs);
}
