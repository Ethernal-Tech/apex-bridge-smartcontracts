// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

/// @title Validators Contract
/// @notice Manages validator registration, validator keys, and signature verification
/// @dev Upgradeable using OpenZeppelin UUPS proxy pattern
contract Validators is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;

    // slither-disable too-many-digits
    /// @dev Precompile for standard signature verification
    address constant PRECOMPILE = 0x0000000000000000000000000000000000002050;
    /// @dev Gas limit for the PRECOMPILE call
    uint32 constant PRECOMPILE_GAS = 50000;
    /// @dev Precompile for BLS signature verification
    address constant VALIDATOR_BLS_PRECOMPILE = 0x0000000000000000000000000000000000002060;
    /// @dev Gas limit for the BLS precompile
    uint32 constant VALIDATOR_BLS_PRECOMPILE_GAS = 50000;

    /// @notice Mapping of chain ID to validator key data
    /// @dev BlockchainId -> ValidatorChainData[]
    mapping(uint8 => ValidatorChainData[]) private chainData;

    /// @notice Mapping of validator address to index
    /// @dev validator address index(+1) in chainData mapping
    mapping(address => uint8) private addressValidatorIndex;

    /// @notice List of current validators set addresses
    /// @dev list of current validators set addresses
    address[] public validators;

    /// @notice Total number of registered validators
    /// @dev max possible number of validators is 127
    uint8 public validatorsCount;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with validators and ownership
    /// @param _owner The owner of the contract
    /// @param _upgradeAdmin The upgrade admin address
    /// @param _validators Initial list of validator addresses
    function initialize(address _owner, address _upgradeAdmin, address[] calldata _validators) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        require(_validators.length < 128, "Too many validators (max 127)");
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
        for (uint8 i; i < _validators.length; i++) {
            if (addressValidatorIndex[_validators[i]] != 0) {
                revert InvalidData("Duplicate validator");
            }
            addressValidatorIndex[_validators[i]] = i + 1;
        }
        validators = _validators;
        validatorsCount = uint8(_validators.length);
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _bridgeAddress The address of the bridge contract
    function setDependencies(address _bridgeAddress) external onlyOwner {
        if (!_isContract(_bridgeAddress)) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
    }

    function isValidator(address _addr) public view returns (bool) {
        return addressValidatorIndex[_addr] != 0;
    }

    function getValidatorIndex(address _addr) public view returns (uint8) {
        return addressValidatorIndex[_addr];
    }

    /// @notice Verifies a standard cryptographic signature against the given input data.
    /// @dev Calls a precompiled contract at the `PRECOMPILE` address with fixed gas to check signature validity.
    ///      The input parameters are ABI-encoded and passed to the precompile: `_data`, `_signature`, `_verifyingKey`, and `_isTx`.
    ///      The result is decoded as a boolean indicating the signature's validity.
    /// @param _data The original data that was signed.
    /// @param _signature The signature over the data.
    /// @param _verifyingKey The public key corresponding to the private key that signed the data.
    /// @param _isTx A boolean flag indicating whether the signature pertains to a transaction.
    /// @return isValid A boolean value indicating whether the signature is valid.
    function isSignatureValid(
        bytes calldata _data,
        bytes calldata _signature,
        uint256 _verifyingKey,
        bool _isTx
    ) public view returns (bool) {
        // solhint-disable-line avoid-low-level-calls
        (bool callSuccess, bytes memory returnData) = PRECOMPILE.staticcall{gas: PRECOMPILE_GAS}(
            abi.encode(_data, _signature, _verifyingKey, _isTx)
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    /// @notice Verifies a BLS signature for a given hash using a provided verifying key
    /// @dev Uses a precompile contract located at `VALIDATOR_BLS_PRECOMPILE` to perform BLS signature verification.
    ///      The BLS precompile expects the inputs to be ABI-encoded and prefixed with a function selector byte `0`.
    ///      Gas usage is capped at `VALIDATOR_BLS_PRECOMPILE_GAS`.
    /// @param _hash The message hash that was signed
    /// @param _signature The BLS signature to verify
    /// @param _verifyingKey The BLS public key of the signer in four 256-bit parts
    /// @return Returns `true` if the signature is valid according to the precompile, otherwise `false`
    function isBlsSignatureValid(
        bytes32 _hash,
        bytes calldata _signature,
        uint256[4] memory _verifyingKey
    ) public view returns (bool) {
        // verify signatures` for provided sig data and sigs bytes
        // solhint-disable-next-line avoid-low-level-calls
        // slither-disable-next-line low-level-calls,calls-loop
        (bool callSuccess, bytes memory returnData) = VALIDATOR_BLS_PRECOMPILE.staticcall{
            gas: VALIDATOR_BLS_PRECOMPILE_GAS
        }(abi.encodePacked(uint8(0), abi.encode(_hash, _signature, _verifyingKey)));
        return callSuccess && abi.decode(returnData, (bool));
    }

    /// @notice Validates multisignature and fee signature from a validator
    /// @param _chainId The chain ID
    /// @param _txRaw Raw transaction data
    /// @param _signature Multisignature of transaction
    /// @param _signatureFee Signature for fee validation
    /// @param _validatorAddr Validator address
    /// @return True if both signatures are valid
    function areSignaturesValid(
        uint8 _chainId,
        bytes calldata _txRaw,
        bytes calldata _signature,
        bytes calldata _signatureFee,
        address _validatorAddr
    ) public view returns (bool) {
        uint256 indx = addressValidatorIndex[_validatorAddr] - 1;
        uint256[4] memory key = chainData[_chainId][indx].key;
        // multisig and fee verification
        return
            isSignatureValid(_txRaw, _signature, key[0], true) && isSignatureValid(_txRaw, _signatureFee, key[1], true);
    }

    /// @notice Verifies BLS signature by validator address
    /// @param _chainId Chain ID
    /// @param _hash The hash to verify
    /// @param _signature The BLS signature
    /// @param _validatorAddr Validator address
    /// @return True if the BLS signature is valid
    function isBlsSignatureValidByValidatorAddress(
        uint8 _chainId,
        bytes32 _hash,
        bytes calldata _signature,
        address _validatorAddr
    ) public view returns (bool) {
        uint256 indx = addressValidatorIndex[_validatorAddr] - 1;
        uint256[4] memory key = chainData[_chainId][indx].key;
        return isBlsSignatureValid(_hash, _signature, key);
    }

    /// @notice Sets the validator-specific chain data for a given chain ID
    /// @dev This function can only be called by the Bridge contract.
    /// It updates the `chainData` mapping with BLS keys or other per-chain validator metadata.
    /// The number of entries in `_chainDatas` must match the current validator count.
    /// Existing data for the chain ID is deleted and fully replaced.
    /// @param _chainId The ID of the blockchain for which validator data is being set
    /// @param _chainDatas An array of structs, each containing a validator address and its associated chain data
    /// @custom:revert InvalidData if the number of provided entries does not match the validator count
    /// @custom:revert InvalidData if any provided address is not a registered validator
    function setValidatorsChainData(
        uint8 _chainId,
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyBridge {
        uint8 validatorsCnt = validatorsCount;
        if (validatorsCnt != _chainDatas.length) {
            revert InvalidData("validators count");
        }

        // recreate array with n elements
        delete chainData[_chainId];

        for (uint i; i < validatorsCnt; i++) {
            chainData[_chainId].push();

            ValidatorAddressChainData calldata dt = _chainDatas[i];
            uint8 indx = addressValidatorIndex[dt.addr];
            if (indx == 0) {
                revert InvalidData("invalid address");
            }

            chainData[_chainId][indx - 1] = dt.data;
        }
    }

    /// @notice Adds or updates the chain-specific data for a given validator
    /// @dev This function can only be called by the Bridge contract.
    ///      If the chain data for the given `_chainId` has not yet been initialized, it creates an array
    ///      of length equal to the total number of validators.
    ///      The validator's data is then set at the corresponding index based on registration order.
    /// @param _chainId The ID of the blockchain for which validator data is being added or updated
    /// @param _addr The address of the validator whose data is being set
    /// @param _data The chain-specific validator data (e.g., BLS keys) to associate with the validator
    /// @custom:revert InvalidData if `_addr` is not a registered validator (implicitly via index underflow)
    function addValidatorChainData(
        uint8 _chainId,
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyBridge {
        if (chainData[_chainId].length == 0) {
            // recreate array with n elements
            for (uint i; i < validatorsCount; i++) {
                chainData[_chainId].push();
            }
        }
        unchecked {
            uint8 indx = addressValidatorIndex[_addr] - 1;
            chainData[_chainId][indx] = _data;
        }
    }

    function getValidatorsChainData(uint8 _chainId) external view returns (ValidatorChainData[] memory) {
        return chainData[_chainId];
    }

    function getQuorumNumberOfValidators() external view returns (uint8 _quorum) {
        // maximum of 127 validators is enforced during initialization
        unchecked {
            return (validatorsCount * 2) / 3 + 1;
        }
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
