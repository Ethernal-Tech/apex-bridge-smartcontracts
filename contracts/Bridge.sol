// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";
import "./SignedBatches.sol";
import "./Slots.sol";
import "./UTXOsc.sol";
import "./Validators.sol";

contract Bridge is IBridge, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    Claims private claims;
    SignedBatches private signedBatches;
    Slots private slots;
    UTXOsc private utxosc;
    Validators private validators;

    Chain[] private chains;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _claimsAddress,
        address _signedBatchesAddress,
        address _slotsAddress,
        address _utxoscAddress,
        address _validatorsAddress
    ) external onlyOwner {
        claims = Claims(_claimsAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        slots = Slots(_slotsAddress);
        utxosc = UTXOsc(_utxoscAddress);
        validators = Validators(_validatorsAddress);
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        claims.submitClaims(_claims, msg.sender);
    }

    // Batches
    function submitSignedBatch(
        SignedBatch calldata _signedBatch
    ) external override onlyValidator {
        if (!shouldCreateBatch(_signedBatch.destinationChainId)) {
            // it will revert also if chain is not registered
            revert CanNotCreateBatchYet(_signedBatch.destinationChainId);
        }
        if (
            !validators.isSignatureValid(
                _signedBatch.destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.multisigSignature,
                _signedBatch.feePayerMultisigSignature,
                msg.sender
            )
        ) {
            revert InvalidSignature();
        }
        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Slots
    function submitLastObservedBlocks(
        string calldata chainID,
        CardanoBlock[] calldata blocks
    ) external override onlyValidator {
        slots.updateBlocks(chainID, blocks, msg.sender);
        slots.updateBlocks(chainID, blocks, msg.sender);
    }

    // Chain registration by Owner
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorAddressCardanoData[] calldata _validatorsAddressCardanoData,
        uint256 _tokenQuantity
    ) public override onlyOwner {
        validators.setValidatorsCardanoData(_chainId, _validatorsAddressCardanoData);
        _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _tokenQuantity);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorCardanoData calldata _validatorCardanoData,
        uint256 _tokenQuantity
    ) external override onlyValidator {
        if (claims.isChainRegistered(_chainId)) {
        if (claims.isChainRegistered(_chainId)) {
            revert ChainAlreadyRegistered(_chainId);
        }
        if (claims.hasVoted(_chainId, msg.sender)) {
        if (claims.hasVoted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        Chain memory _chain = Chain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer);
        bytes32 chainHash = keccak256(abi.encode(_chain));

        claims.setVoted(_chainId, msg.sender, chainHash);
        validators.addValidatorCardanoData(_chainId, msg.sender, _validatorCardanoData);

        if (claims.getNumberOfVotes(chainHash) == validators.getValidatorsCount()) {
            _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _tokenQuantity);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    function _registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        uint256 _tokenQuantity
    ) internal {
        claims.setChainRegistered(_chainId);
        claims.setChainRegistered(_chainId);
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;

        utxosc.setInitialUTxOs(_chainId, _initialUTXOs);
        utxosc.setInitialUTxOs(_chainId, _initialUTXOs);

        claims.setTokenQuantity(_chainId, _tokenQuantity);
        claims.setTokenQuantity(_chainId, _tokenQuantity);

        claims.resetCurrentBatchBlock(_chainId);
        claims.resetCurrentBatchBlock(_chainId);

        claims.setNextTimeoutBlock(_chainId, block.number);
        claims.setNextTimeoutBlock(_chainId, block.number);

        emit newChainRegistered(_chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(
        string calldata _destinationChain
    ) public view override returns (bool batch) {
        if (
            claims.isBatchCreated(_destinationChain) ||
            signedBatches.isBatchAlreadySubmittedBy(_destinationChain, msg.sender)
        ) {
            return false;
        }

        return claims.shouldCreateBatch(_destinationChain);
        return claims.shouldCreateBatch(_destinationChain);
    }

    function getNextBatchId(
        string calldata _destinationChain
    ) external view override returns (uint256 result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        (uint256 batchId, ) = signedBatches.lastConfirmedBatch(_destinationChain);

        return batchId + 1;
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    )
        external
        view
        override
        returns (ConfirmedTransaction[] memory _confirmedTransactions)
    {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint256 firstTxNonce = claims.lastBatchedTxNonce(_destinationChain) + 1;
        uint256 firstTxNonce = claims.lastBatchedTxNonce(_destinationChain) + 1;

        uint256 counterConfirmedTransactions = claims.getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint i = 0; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = claims.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    function getAvailableUTXOs(
        string calldata _destinationChain
    ) external view override returns (UTXOs memory availableUTXOs) {
        return utxosc.getChainUTXOs(_destinationChain);
        return utxosc.getChainUTXOs(_destinationChain);
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
        return signedBatches.getConfirmedBatch(_destinationChain);
        return signedBatches.getConfirmedBatch(_destinationChain);
    }

    function getValidatorsCardanoData(
        string calldata _chainId
    ) external view override returns (ValidatorCardanoData[] memory validatorCardanoData) {
        return validators.getValidatorsCardanoData(_chainId);
    }

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (CardanoBlock memory cblock) {
        return slots.getLastObservedBlock(_sourceChain);
        return slots.getLastObservedBlock(_sourceChain);
    }

    function getAllRegisteredChains()
        external
        view
        override
        returns (Chain[] memory _chains)
    {
        return chains;
    }

    function getRawTransactionFromLastBatch(
        string calldata _destinationChain
    ) external view override returns (string memory) {
        (, string memory _rawTransaction) = signedBatches.lastConfirmedBatch(_destinationChain);
        return _rawTransaction;
    }

    modifier onlyValidator() {
        if (!validators.isValidator(msg.sender)) revert NotValidator();
        _;
    }
}
