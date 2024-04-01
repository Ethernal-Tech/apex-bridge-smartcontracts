// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./IBridgeContractStructs.sol";

abstract contract IBridgeContract is IBridgeContractStructs {
    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    // Slots
    function submitLastObservableBlocks(string calldata chainID, CardanoBlock[] calldata blocks) external virtual;

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorAddressCardanoData[] calldata validatorData,
        uint256 _tokenQuantity
    ) external virtual;

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorCardanoData calldata validatorData,
        uint256 _tokenQuantity
    ) external virtual;

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external view virtual returns (bool);

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external virtual returns (ConfirmedTransaction[] memory confirmedTransactions);

    // Return all available utxos for both multisig and fee payer. Batcher should sort these by nonce
    function getAvailableUTXOs(
        string calldata _destinationChain
    ) external view virtual returns (UTXOs memory availableUTXOs);

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view virtual returns (ConfirmedBatch memory batch);

    function getValidatorsCardanoData(string calldata _chainId) external view virtual returns (ValidatorCardanoData[] memory validators);

    function getLastObservedBlock(string calldata _sourceChain) external view virtual returns (CardanoBlock memory cblock);

    function getAllRegisteredChains() external view virtual returns (Chain[] memory _chains);

    function isChainRegistered(string calldata _chainId) external view virtual returns (bool);

    function getQuorumNumberOfValidators() external view virtual returns (uint8);

    function getNumberOfVotes(bytes32 _claimHash) external view virtual returns (uint8);
}
