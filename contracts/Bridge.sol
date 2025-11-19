// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Utils.sol";
import "./Claims.sol";
import "./SignedBatches.sol";
import "./Slots.sol";
import "./Validators.sol";

/// @title Bridge
/// @notice Cross-chain bridge for validator claim submission,
/// batch transaction signing, and governance-based chain registration.
/// @dev UUPS upgradeable and modular via dependency contracts (Claims, Validators, Slots, SignedBatches).
contract Bridge is IBridge, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {    
    address private upgradeAdmin;
    Claims private claims;
    SignedBatches private signedBatches;
    Slots private slots;
    Validators private validators;

    /// @notice Array of registered chains.
    Chain[] private chains;

    /// @notice Max number of blocks that can be submitted at once.
    uint8 constant MAX_NUMBER_OF_BLOCKS = 40;

    /// @notice system address to limit access to certain functions
    address public constant SYSTEM = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract.
    /// @param _owner Owner of the contract.
    /// @param _upgradeAdmin Admin address authorized to upgrade the contract.
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    /// @notice Authorizes a new implementation for upgrade
    /// @param newImplementation Address of the new implementation contract
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _claimsAddress Address of Claims contract.
    /// @param _signedBatchesAddress Address of SignedBatches contract.
    /// @param _slotsAddress Address of Slots contract.
    /// @param _validatorsAddress Address of Validators contract.
    function setDependencies(
        address _claimsAddress,
        address _signedBatchesAddress,
        address _slotsAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_claimsAddress) ||
            !_isContract(_signedBatchesAddress) ||
            !_isContract(_slotsAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        claims = Claims(_claimsAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        slots = Slots(_slotsAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Submit claims from validators for reaching consensus.
    /// @param _claims The claims submitted by a validator.
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        claims.submitClaims(_claims, msg.sender);
    }

    /// @notice Submit a signed transaction batch for the Cardano chain.
    /// @param _signedBatch The batch of signed transactions.
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!claims.shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
        }

        _pendingValidatorSetCheck(_signedBatch);

        // Only validate signatures if NOT FINAL, FINAL is a flag with no signatures
        if (_signedBatch.batchType != BatchTypesLib.VALIDATORSET_FINAL) {
            bool valid = validators.areSignaturesValid(
                _signedBatch.destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.signature,
                _signedBatch.feeSignature,
                msg.sender
            );
            if (!valid) revert InvalidSignature();
        }

        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
    }

    /// @notice Submit a signed transaction batch for an EVM-compatible chain.
    /// @param _signedBatch The batch of signed transactions.
    function submitSignedBatchEVM(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!claims.shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
        }

        _pendingValidatorSetCheck(_signedBatch);

        if (_signedBatch.batchType != BatchTypesLib.VALIDATORSET_FINAL) {
            bool valid = validators.isBlsSignatureValidByValidatorAddress(
                _signedBatch.destinationChainId,
                keccak256(_signedBatch.rawTransaction),
                _signedBatch.signature,
                msg.sender
            );

            if (!valid) revert InvalidSignature();
        }

        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
    }

    function _pendingValidatorSetCheck(SignedBatch calldata _signedBatch) internal view {
        bool isValidatorSetBatch = _signedBatch.batchType == BatchTypesLib.VALIDATORSET ||
            _signedBatch.batchType == BatchTypesLib.VALIDATORSET_FINAL;

        bool isPending = validators.newValidatorSetPending();

        if (isPending != isValidatorSetBatch) {
            if (isPending) {
                revert NewValidatorSetPending();
            } else {
                revert NoNewValidatorSetPending();
            }
        }
    }

    /// @notice Submit new validator set data
    /// @param _newValidatorSetDelta Full validator data for all of the new validators.
    function submitNewValidatorSet(NewValidatorSetDelta calldata _newValidatorSetDelta) external override onlySystem {
        if (validators.newValidatorSetPending()) {
            revert NewValidatorSetPending();
        }

        validators.submitNewValidatorSet(_newValidatorSetDelta, chains);

        emit newValidatorSetSubmitted();
    }

    /// @notice Submit the last observed Cardano blocks from validators for synchronization purposes.
    /// @param _chainId The source chain ID.
    /// @param _blocks Array of Cardano blocks to be recorded.
    function submitLastObservedBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks) external override onlyValidator {
        if (validators.newValidatorSetPending()) {
            revert NewValidatorSetPending();
        }

        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }

        if (_blocks.length > MAX_NUMBER_OF_BLOCKS) {
            revert TooManyBlocks(_blocks.length, MAX_NUMBER_OF_BLOCKS);
        }

        slots.updateBlocks(_chainId, _blocks, msg.sender);
    }

    /// @notice Set additional metadata for a chain, such as multisig and fee payer addresses.
    /// @param _chainId The target chain ID.
    /// @param addressMultisig Multisig address associated with the chain.
    /// @param addressFeePayer Fee payer address used for covering transaction costs.
    function setChainAdditionalData(
        uint8 _chainId,
        string calldata addressMultisig,
        string calldata addressFeePayer
    ) external override onlyOwner {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }
        uint256 _chainsLength = chains.length;
        for (uint i; i < _chainsLength; i++) {
            if (chains[i].id == _chainId) {
                chains[i].addressMultisig = addressMultisig;
                chains[i].addressFeePayer = addressFeePayer;
                break;
            }
        }
    }

    /// @notice Register a new chain and its validator data.
    /// @param _chain Metadata and configuration of the new chain.
    /// @param _tokenQuantity Initial token allocation.
    /// @param _validatorData Validator data specific to this chain.
    function registerChain(
        Chain calldata _chain,
        uint256 _tokenQuantity,
        ValidatorAddressChainData[] calldata _validatorData
    ) public override onlyOwner {
        uint256 _validatorAddressChainDataLength = _validatorData.length;

        if (_validatorAddressChainDataLength < 4 || _validatorAddressChainDataLength > 126) {
            revert InvalidData("ValidatorAddressChainData");
        }

        uint8 _chainType = _chain.chainType;

        for (uint i; i < _validatorAddressChainDataLength; i++) {
            address _validatorAddress = _validatorData[i].addr;

            if (_validatorAddress == address(0)) {
                revert ZeroAddress();
            }

            validators.validateSignatures(
                _chainType,
                _validatorAddress,
                _validatorData[i].keySignature,
                _validatorData[i].keyFeeSignature,
                _validatorData[i].data
            );
        }

        uint8 _chainId = _chain.id;

        validators.setValidatorsChainData(_chainId, _validatorData);

        if (!claims.isChainRegistered(_chainId)) {
            chains.push(_chain);
            claims.setChainRegistered(_chainId, _tokenQuantity);
            emit newChainRegistered(_chainId);
        }
    }

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
        ValidatorChainData calldata _validatorChainData,
        bytes calldata _keySignature,
        bytes calldata _keyFeeSignature
    ) external override onlyValidator {
        if (claims.isChainRegistered(_chainId)) {
            revert ChainAlreadyRegistered(_chainId);
        }

        bytes32 chainHash = keccak256(
            abi.encode(validators.currentValidatorSetId(), _chainId, _chainType, _tokenQuantity)
        );

        if (claims.hasVoted(chainHash, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        validators.validateSignatures(_chainType, msg.sender, _keySignature, _keyFeeSignature, _validatorChainData);

        validators.addValidatorChainData(_chainId, msg.sender, _validatorChainData);

        uint8 _validatorIdx = validators.getValidatorIndex(msg.sender) - 1;

        if (claims.setVotedOnlyIfNeededReturnQuorumReached(_validatorIdx, chainHash, validators.validatorsCount())) {
            chains.push(Chain(_chainId, _chainType, "", ""));

            claims.setChainRegistered(_chainId, _tokenQuantity);
            emit newChainRegistered(_chainId);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    /// @notice Check if a batch should be created for the destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _shouldCreateBatch Returns true if a batch should be created.
    function shouldCreateBatch(uint8 _destinationChain) public view override returns (bool _shouldCreateBatch) {
        return claims.shouldCreateBatch(_destinationChain);
    }

    /// @notice Get the next batch ID if a batch should be created, or 0 if not.
    /// @param _destinationChain ID of the destination chain.
    /// @return _result ID of the next batch or 0 if no batch should be created.
    function getNextBatchId(uint8 _destinationChain) external view override returns (uint64 _result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        uint64 batchId = signedBatches.getConfirmedBatchId(_destinationChain);

        return batchId + 1;
    }

    /// @notice Get confirmed transactions ready for batching for a specific destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _confirmedTransactions Array of confirmed transactions.
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!claims.shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint64 firstTxNonce = claims.lastBatchedTxNonce(_destinationChain) + 1;

        uint64 counterConfirmedTransactions = claims.getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint64 i; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = claims.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    /// @notice Notifies the bridge that new validator set has been implemented on Blade
    /// @dev This function is called by the system to update the validator set and make all
    ///      necessary adjustments in the bridge state.
    function validatorSetUpdated() external override onlySystem {
        validators.validatorSetUpdated(chains);
    }

    /// @notice Get the confirmed batch for the given destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _batch The confirmed batch details.
    function getConfirmedBatch(uint8 _destinationChain) external view override returns (ConfirmedBatch memory _batch) {
        return signedBatches.getConfirmedBatch(_destinationChain);
    }

    /// @notice Retrieve validator chain-specific data for a given chain ID.
    /// @param _chainId ID of the chain.
    /// @return Array of validator data.
    function getValidatorsChainData(uint8 _chainId) external view override returns (ValidatorChainData[] memory) {
        return validators.getValidatorsChainData(_chainId);
    }

    /// @notice Get the last observed block for a given source chain.
    /// @param _sourceChain ID of the source chain.
    /// @return _cblock The last observed Cardano block.
    function getLastObservedBlock(uint8 _sourceChain) external view override returns (CardanoBlock memory _cblock) {
        return slots.getLastObservedBlock(_sourceChain);
    }

    /// @notice Return a list of all chains currently registered with the bridge.
    /// @return _chains Array of registered chain data.
    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    /// @notice Get raw transaction data from the most recent batch for a given destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return Raw bytes of the transaction data.
    function getRawTransactionAndBatchTypeFromLastBatch(
        uint8 _destinationChain
    ) external view override returns (bytes memory, uint8) {
        return signedBatches.getConfirmedBatchTransactionAndBatchType(_destinationChain);
    }

    /// @notice Get transactions included in a specific batch for a given chain.
    /// @param _chainId ID of the chain.
    /// @param _batchId ID of the batch.
    /// @return status Status of the batch.
    /// @return txs Array of transaction data included in the batch.
    function getBatchStatusAndTransactions(
        uint8 _chainId,
        uint64 _batchId
    ) external view override returns (uint8 status, TxDataInfo[] memory txs) {
        return claims.getBatchStatusAndTransactions(_chainId, _batchId);
    }

    /// @notice Check if a new validator set is pending.
    /// @return _pending True if a new validator set is pending, false otherwise.
    function isNewValidatorSetPending() external view override returns (bool _pending) {
        return validators.newValidatorSetPending();
    }

    /// @notice Get the delta of the new validator set.
    /// @return _newValidatorSetDelta The new validator set delta.
    function getNewValidatorSetDelta()
        external
        view
        override
        returns (NewValidatorSetDelta memory _newValidatorSetDelta)
    {
        if (!validators.newValidatorSetPending()) {
            revert NoNewValidatorSetPending();
        }
        return validators.getNewValidatorSetDelta();
    }

    function getAddressValidatorIndex(address _validator) external view returns (uint8) {
        return validators.getValidatorIndex(_validator);
    }

    function getCurrentValidatorSetId() external view override returns (uint256) {
        return validators.currentValidatorSetId();
    }

    /// @notice Return a a number of registered chains
    /// @return number of registered chains
    function getAllRegisteredChainsCount() external view returns (uint8) {
        return uint8(chains.length);
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.1.1";
    }

    modifier onlyValidator() {
        if (!validators.isValidator(msg.sender)) revert NotValidator();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != address(claims)) revert NotClaims();
        _;
    }

    modifier onlySignedBatches() {
        if (msg.sender != address(signedBatches)) revert NotSignedBatches();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }

    modifier onlySystem() {
        if (msg.sender != SYSTEM) revert NotSystem();
        _;
    }
}
