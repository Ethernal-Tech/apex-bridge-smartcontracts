// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
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
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
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
    }

    // Slots
    function submitLastObservedBlocks(
        string calldata chainID,
        CardanoBlock[] calldata blocks
    ) external override onlyValidator {
        slots.updateBlocks(chainID, blocks, msg.sender);
    }

    // Chain registration by Owner
    function registerChain(
        Chain calldata _chain,
        UTXOs calldata _initialUTXOs,
        uint256 _tokenQuantity,
        ValidatorAddressCardanoData[] calldata _validatorsAddressCardanoData
    ) public override onlyOwner {
        validators.setValidatorsCardanoData(_chain.id, _validatorsAddressCardanoData);
        _registerChain(_chain, _initialUTXOs, _tokenQuantity);
    }

    function registerChainGovernance(
        Chain calldata _chain,
        UTXOs calldata _initialUTXOs,
        uint256 _tokenQuantity,
        ValidatorCardanoData calldata _validatorCardanoData
    ) external override onlyValidator {
        if (claims.isChainRegistered(_chain.id)) {
            revert ChainAlreadyRegistered(_chain.id);
        }
        if (claims.hasVoted(_chain.id, msg.sender)) {
            revert AlreadyProposed(_chain.id);
        }

        bytes32 chainHash = keccak256(abi.encode(_chain, _initialUTXOs, _tokenQuantity));

        validators.addValidatorCardanoData(_chain.id, msg.sender, _validatorCardanoData);

        if (claims.setVoted(_chain.id, msg.sender, chainHash) == validators.getValidatorsCount()) {
            _registerChain(_chain, _initialUTXOs, _tokenQuantity);
        } else {
            emit newChainProposal(_chain.id, msg.sender);
        }
    }

    function _registerChain(Chain calldata _chain, UTXOs calldata _initialUTXOs, uint256 _tokenQuantity) internal {
        claims.setChainRegistered(_chain.id);
        chains.push();
        chains[chains.length - 1].id = _chain.id;
        chains[chains.length - 1].addressMultisig = _chain.addressMultisig;
        chains[chains.length - 1].addressFeePayer = _chain.addressFeePayer;

        utxosc.setInitialUTxOs(_chain.id, _initialUTXOs);

        claims.setTokenQuantity(_chain.id, _tokenQuantity);

        claims.resetCurrentBatchBlock(_chain.id);

        claims.setNextTimeoutBlock(_chain.id, block.number);

        emit newChainRegistered(_chain.id);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) public view override returns (bool batch) {
        if (
            claims.isBatchCreated(_destinationChain) ||
            signedBatches.isBatchAlreadySubmittedBy(_destinationChain, msg.sender)
        ) {
            return false;
        }

        return claims.shouldCreateBatch(_destinationChain);
    }

    function getNextBatchId(string calldata _destinationChain) external view override returns (uint256 result) {
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
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

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
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
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
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
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
