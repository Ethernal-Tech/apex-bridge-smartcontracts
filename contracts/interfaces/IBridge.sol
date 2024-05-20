// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./IBridgeStructs.sol";

abstract contract IBridge is IBridgeStructs {
    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    // Slots
    function submitLastObservedBlocks(string calldata chainID, CardanoBlock[] calldata blocks) external virtual;

    // Chain registration through some kind of governance
    function registerChain(
        Chain calldata _chain,
        UTXOs calldata _initialUTXOs,
        uint256 _tokenQuantity,
        ValidatorAddressCardanoData[] calldata _validatorData
    ) external virtual;

    function registerChainGovernance(
        Chain calldata _chain,
        UTXOs calldata _initialUTXOs,
        uint256 _tokenQuantity,
        ValidatorCardanoData calldata _validatorData
    ) external virtual;

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external view virtual returns (bool);

    // Calls shouldCreateBatch and returns next batch id if batch should be created of 0 if not
    function getNextBatchId(string calldata _destinationChain) external view virtual returns (uint256);

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view virtual returns (ConfirmedTransaction[] memory confirmedTransactions);

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig
    // address that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(
        string calldata _destinationChain
    ) external view virtual returns (UTXOs memory availableUTXOs);

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view virtual returns (ConfirmedBatch memory batch);

    function getValidatorsCardanoData(
        string calldata _chainId
    ) external view virtual returns (ValidatorCardanoData[] memory validatorsArray);

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view virtual returns (CardanoBlock memory cblock);

    function getAllRegisteredChains() external view virtual returns (Chain[] memory _chains);

    function getRawTransactionFromLastBatch(
        string calldata _destinationChain
    ) external view virtual returns (string memory);
}
