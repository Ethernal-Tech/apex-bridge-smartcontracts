// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./IBridgeStructs.sol";

abstract contract IBridge is IBridgeStructs {
    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    // Batches Cardano
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    // Batches EVM
    function submitSignedBatchEVM(SignedBatch calldata _signedBatch) external virtual;

    // Slots
    function submitChainStatusData(
        uint8 chainId,
        CardanoBlock[] calldata blocks,
        TokenAmount[] calldata tokenAmounts
    ) external virtual;

    // set additional chain data (sc address for nexus)
    function setChainAdditionalData(
        uint8 _chainId,
        string calldata addressMultisig,
        string calldata addressFeePayer
    ) external virtual;

    // Chain registration through some kind of governance
    function registerChain(Chain calldata _chain, ValidatorAddressChainData[] calldata _validatorData) external virtual;

    function registerChainGovernance(
        uint8 _chainId,
        uint8 _chainType,
        ValidatorChainData calldata _validatorChainData
    ) external virtual;

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(uint8 _destinationChain) external view virtual returns (bool _shouldCreateBatch);

    // Calls shouldCreateBatch and returns next batch id if batch should be created of 0 if not
    function getNextBatchId(uint8 _destinationChain) external view virtual returns (uint64 _result);

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view virtual returns (ConfirmedTransaction[] memory _confirmedTransactions);

    function getConfirmedBatch(uint8 _destinationChain) external view virtual returns (ConfirmedBatch memory _batch);

    function getValidatorsChainData(uint8 _chainId) external view virtual returns (ValidatorChainData[] memory);

    function getLastObservedBlock(uint8 _sourceChain) external view virtual returns (CardanoBlock memory _cblock);

    function getAllRegisteredChains() external view virtual returns (Chain[] memory _chains);

    function getRawTransactionFromLastBatch(uint8 _destinationChain) external view virtual returns (bytes memory);
}
