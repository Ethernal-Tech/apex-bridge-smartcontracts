// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

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
    function submitLastObservedBlocks(uint8 chainId, CardanoBlock[] calldata blocks) external override onlyValidator {
        slots.updateBlocks(chainId, blocks, msg.sender);
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
        uint8 chainId = _chain.id;
        if (claims.isChainRegistered(chainId)) {
            revert ChainAlreadyRegistered(chainId);
        }
        if (claims.hasVoted(Strings.toString(chainId), msg.sender)) {
            revert AlreadyProposed(Strings.toString(chainId));
        }

        bytes32 chainHash = keccak256(abi.encode(_chain, _initialUTXOs, _tokenQuantity));

        validators.addValidatorCardanoData(chainId, msg.sender, _validatorCardanoData);

        if (claims.setVoted(Strings.toString(chainId), msg.sender, chainHash) == validators.getValidatorsCount()) {
            _registerChain(_chain, _initialUTXOs, _tokenQuantity);
        } else {
            emit newChainProposal(chainId, msg.sender);
        }
    }

    function _registerChain(Chain calldata _chain, UTXOs calldata _initialUTXOs, uint256 _tokenQuantity) internal {
        uint8 chainId = _chain.id;
        claims.setChainRegistered(chainId);
        chains.push();
        uint256 chainIndex = chains.length - 1;
        chains[chainIndex].id = chainId;
        chains[chainIndex].addressMultisig = _chain.addressMultisig;
        chains[chainIndex].addressFeePayer = _chain.addressFeePayer;

        utxosc.setInitialUTxOs(chainId, _initialUTXOs);

        claims.setTokenQuantity(chainId, _tokenQuantity);

        claims.resetCurrentBatchBlock(chainId);

        claims.setNextTimeoutBlock(chainId, block.number);

        emit newChainRegistered(chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(uint8 _destinationChain) public view override returns (bool batch) {
        if (
            claims.isBatchCreated(_destinationChain) ||
            signedBatches.isBatchAlreadySubmittedBy(_destinationChain, msg.sender)
        ) {
            return false;
        }

        return claims.shouldCreateBatch(_destinationChain);
    }

    function getNextBatchId(uint8 _destinationChain) external view override returns (uint256 result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        (uint256 batchId, ) = signedBatches.lastConfirmedBatch(_destinationChain);

        return batchId + 1;
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint256 firstTxNonce = claims.lastBatchedTxNonce(_destinationChain) + 1;

        uint256 counterConfirmedTransactions = claims.getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint i; i < counterConfirmedTransactions; ) {
            _confirmedTransactions[i] = claims.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
            //prettier-ignore
            unchecked { i++; }
        }

        return _confirmedTransactions;
    }

    function getAvailableUTXOs(uint8 _destinationChain) external view override returns (UTXOs memory availableUTXOs) {
        return utxosc.getChainUTXOs(_destinationChain);
    }

    function getConfirmedBatch(uint8 _destinationChain) external view override returns (ConfirmedBatch memory batch) {
        return signedBatches.getConfirmedBatch(_destinationChain);
    }

    function getValidatorsCardanoData(
        uint8 _chainId
    ) external view override returns (ValidatorCardanoData[] memory validatorCardanoData) {
        return validators.getValidatorsCardanoData(_chainId);
    }

    function getLastObservedBlock(uint8 _sourceChain) external view override returns (CardanoBlock memory cblock) {
        return slots.getLastObservedBlock(_sourceChain);
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function getRawTransactionFromLastBatch(uint8 _destinationChain) external view override returns (string memory) {
        (, string memory _rawTransaction) = signedBatches.lastConfirmedBatch(_destinationChain);
        return _rawTransaction;
    }

    modifier onlyValidator() {
        if (!validators.isValidator(msg.sender)) revert NotValidator();
        _;
    }
}
