// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./interfaces/TransactionTypesLib.sol";
import "./BridgingAddresses.sol";
import "./ChainTokens.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Registration.sol";
import "./SignedBatches.sol";
import "./Slots.sol";
import "./Utils.sol";
import "./Validators.sol";

/// @title Bridge
/// @notice Cross-chain bridge for validator claim submission, batch transaction signing, and governance-based chain registration.
/// @dev UUPS upgradeable and modular via dependency contracts (Claims, Validators, Slots, SignedBatches, BridgingAddresses).
contract Bridge is IBridge, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    Claims private claims;
    SignedBatches private signedBatches;
    Slots private slots;
    Validators private validators;

    /// @notice Depricated: Array of registered chains.
    ///      Use registration.chains instead.
    Chain[] private __chains;

    BridgingAddresses public bridgingAddresses;
    ChainTokens private chainTokens;
    ClaimsHelper private claimsHelper;
    Registration private registration;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[46] private __gap;

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

    /// @notice Sets the external contracts dependencies and syncs it with the registered chains.
    /// @dev This function can only be called by the upgrade admin.
    ///      It verifies that the provided address is a contract before using it.
    /// @param _bridgingAddresses The address of the deployed BridgingAddresses contract.
    /// @param _chainTokensAddress The address of the deployed ChainTokens contract.
    /// @param _registrationAddress The address of the deployed Registration contract.
    /// @param _claimsHelperAddress The address of the deployed ClaimsHelper contract.
    /// @param isInitialDeployment Indicates whether this call occurs during the initial deployment of the contract. Set to false for upgrades.
    function setAdditionalDependenciesAndSync(
        address _bridgingAddresses,
        address _chainTokensAddress,
        address _claimsHelperAddress,
        address _registrationAddress,
        bool isInitialDeployment
    ) external onlyUpgradeAdmin {
        if (isInitialDeployment) {
            if (!_isContract(_bridgingAddresses)) revert NotContractAddress();
            bridgingAddresses = BridgingAddresses(_bridgingAddresses);
        }

        if (
            !_isContract(_chainTokensAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_registrationAddress)
        ) revert NotContractAddress();
        chainTokens = ChainTokens(_chainTokensAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        registration = Registration(_registrationAddress);
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

        signedBatches.submitSignedBatch(_signedBatch, msg.sender, false);
    }

    /// @notice Submit a signed transaction batch for an EVM-compatible chain.
    /// @param _signedBatch The batch of signed transactions.
    function submitSignedBatchEVM(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!claims.shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
        }

        signedBatches.submitSignedBatch(_signedBatch, msg.sender, true);
    }

    /// @notice Submit the last observed Cardano blocks from validators for synchronization purposes.
    /// @param _chainId The source chain ID.
    /// @param _blocks Array of Cardano blocks to be recorded.
    function submitLastObservedBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks) external override onlyValidator {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
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
        registration.setChainAdditionalData(_chainId, addressMultisig, addressFeePayer);
    }

    /// @notice Register a new chain and its validator data.
    /// @param _chain Metadata and configuration of the new chain.
    /// @param _tokenQuantity Initial token allocation.
    /// @param _validatorData Validator data specific to this chain.
    function registerChain(
        Chain calldata _chain,
        uint256 _tokenQuantity,
        uint256 _wrappedTokenQuantity,
        ValidatorAddressChainData[] calldata _validatorData
    ) public override onlyOwner {
        registration.registerChain(_chain, _tokenQuantity, _wrappedTokenQuantity, _validatorData);
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
        uint256 _wrappedTokenQuantity,
        ValidatorChainData calldata _validatorChainData,
        bytes calldata _keySignature,
        bytes calldata _keyFeeSignature
    ) external override onlyValidator {
        registration.registerChainGovernance(
            _chainId,
            _chainType,
            _tokenQuantity,
            _wrappedTokenQuantity,
            _validatorChainData,
            _keySignature,
            _keyFeeSignature,
            msg.sender
        );
    }

    /// @notice Register a new chain and its validator data.
    /// @param _coloredCoin Colored Coin metadata.
    function registerColoredCoin(ColoredCoin calldata _coloredCoin) public override onlyOwner {
        registration.registerColoredCoin(_coloredCoin);
    }

    /// @notice Register a new Colored Coin using governance.
    /// @param _coloredCoin The Colored Coin metadata.
    function registerColoredCoinGovernance(ColoredCoin calldata _coloredCoin) external override onlyValidator {
        registration.registerColoredCoinGovernance(_coloredCoin, msg.sender);
    }

    /// @notice Check if a regular or stake delegation batch should be created for the destination chain.
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

        return signedBatches.getConfirmedBatchId(_destinationChain) + 1;
    }

    /// @notice Get confirmed transactions ready for batching for a specific destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return _confirmedTransactions Array of confirmed transactions.
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        return claims.getConfirmedTransactions(_destinationChain);
    }

    /// @notice Returns the number of bridging addresses for a given chain.
    /// @dev Useful for querying how many multisig addresses are configured per chain.
    /// @param chainId The ID of the chain to query.
    /// @return The total count of bridging addresses for the specified chain.
    function getBridgingAddressesCount(uint8 chainId) external view override returns (uint8) {
        return bridgingAddresses.bridgingAddressesCount(chainId);
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
        return registration.getAllRegisteredChains();
    }

    /// @notice Get raw transaction data from the most recent batch for a given destination chain.
    /// @param _destinationChain ID of the destination chain.
    /// @return Raw bytes of the transaction data.
    function getRawTransactionFromLastBatch(uint8 _destinationChain) external view override returns (bytes memory) {
        return signedBatches.getConfirmedBatchTransaction(_destinationChain);
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

    /// @dev Converts a bytes32 value to a bytes array.
    /// @param input Input bytes32 value.
    function _bytes32ToBytesAssembly(bytes32 input) internal pure returns (bytes memory output) {
        output = new bytes(32);

        assembly {
            mstore(add(output, 32), input)
        }

        return output;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.3.0";
    }

    modifier onlyValidator() {
        if (!validators.isValidator(msg.sender)) revert NotValidator();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }
}
