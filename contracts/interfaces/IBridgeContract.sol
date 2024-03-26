// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./IBridgeContractStructs.sol";

abstract contract IBridgeContract is IBridgeContractStructs {
    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external virtual;

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external virtual;

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        string calldata _keyHashMultisig,
        string calldata _keyHashFeePayer,
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

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig address
    // that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external view virtual returns (UTXOs memory availableUTXOs);

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view virtual returns (ConfirmedBatch memory batch);

    function getLastObservedBlockInfo(string calldata _sourceChain) external view virtual returns (LastObservedBlockInfo memory lastObservedBlockInfo);

    function getAllRegisteredChains() external view virtual returns (Chain[] memory _chains);

    function isChainRegistered(string calldata _chainId) external view virtual returns (bool);

    function getValidatorsCount() external view virtual returns (uint8);

    function getNumberOfVotes(bytes32 _claimHash) external view virtual returns (uint8);
}
