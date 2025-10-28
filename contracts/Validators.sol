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
    mapping(address => uint8) public addressValidatorIndex;

    /// @notice Total number of registered validators
    /// @dev max possible number of validators is 127
    uint8 public validatorsCount;

    /// @notice Addresses of validators in the current validator set
    address[] public validatorAddresses;

    /// @notice Full new validator set Delta compared to the current one
    NewValidatorSetDelta newValidatorSetDelta;

    /// @notice Flag for new validator set pending
    bool public newValidatorSetPending;

    /// @notice Id of the current validator set
    /// @dev This is used to track the current validator set version
    uint256 public currentValidatorSetId;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[46] private __gap;

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
                revert InvalidData("DuplicatedValidator");
            }
            addressValidatorIndex[_validators[i]] = i + 1;
        }
        validatorsCount = uint8(_validators.length);
    }

    /// @notice Sets the external contract dependencies.
    /// @dev This function can only be called by the upgrade admin. It verifies that the provided address is a contract.
    /// @param _validators Current list of validator addresses
    function setAdditionalDependenciesAndSync(address[] calldata _validators) external onlyUpgradeAdmin {
        for (uint8 i; i < _validators.length; i++) {
            validatorAddresses.push(_validators[i]);
        }
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
        bytes memory _data,
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
            revert InvalidData("WrongNumberOfValidators");
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
    function addValidatorChainData(uint8 _chainId, address _addr, ValidatorChainData memory _data) public onlyBridge {
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

    /// @notice Validates the new validator set data
    /// @param _newValidatorSetDelta Full set of changed in the validator set
    /// @dev checks that there are as many new validator set as there are registered chains
    /// @dev checks that number of validators is between 4 and 126 - allowed values
    /// @dev checks that number of validators is the same for all chains
    /// @dev checks that there is a new validator set for all registered chains and for Blade chain
    /// @dev checks that address of validators is not zero
    /// @dev checkes for duplicate validator addresses
    function _validateValidatorSet(
        NewValidatorSetDelta calldata _newValidatorSetDelta,
        Chain[] memory _chains
    ) internal view {
        //validator set needs to include validator data for all chains
        uint256 _numberOfChainsInValidatorSets = _newValidatorSetDelta.addedValidators.length;
        uint256 _numberOfRegisteredChains = _chains.length;

        // checks that there are as many new validator set as there are registered chains
        // validator set for Blade chain will always be included in the _validatorSet, but Blade
        // is never registered as a chain on bridge, thus +1
        if (_numberOfChainsInValidatorSets != 0 && _numberOfChainsInValidatorSets != _numberOfRegisteredChains + 1) {
            revert InvalidData("WrongNumberOfChains");
        }

        uint256 numberOfNewValidators = _newValidatorSetDelta.addedValidators.length == 0
            ? 0
            : _newValidatorSetDelta.addedValidators[0].validators.length;

        // the number of validators must bet between 4 and 126

        uint256 newValidatorSetSize = validatorsCount +
            numberOfNewValidators -
            _newValidatorSetDelta.removedValidators.length;

        if (newValidatorSetSize < 4 || newValidatorSetSize > 126) {
            revert InvalidData("WrongNumberOfValidators");
        }

        // all chains must have the same number of validators
        for (uint256 i = 1; i < _numberOfChainsInValidatorSets; i++) {
            if (_newValidatorSetDelta.addedValidators[i].validators.length != numberOfNewValidators) {
                revert InvalidData("WrongNumberOfValidators");
            }
        }

        for (uint i; i < _numberOfChainsInValidatorSets; i++) {
            bool atLeastOneProcessed = false;
            // checks that there is a new validator set for all registered chains
            // and for Blade -> chainId == 255
            for (uint256 j; j < _numberOfRegisteredChains; j++) {
                if (
                    _newValidatorSetDelta.addedValidators[i].chainId != _chains[j].id &&
                    _newValidatorSetDelta.addedValidators[i].chainId != 255
                ) {
                    continue;
                }
                atLeastOneProcessed = true; // This validator matches the chain
            }

            if (!atLeastOneProcessed) {
                revert InvalidData("ChainIdMismatch");
            }

            //check that validator addresses are not zero addresses
            for (uint256 k; k < numberOfNewValidators; k++) {
                address _validatorAddress = _newValidatorSetDelta.addedValidators[i].validators[k].addr;

                if (_validatorAddress == address(0)) {
                    revert ZeroAddress();
                }

                //checks for duplicate validator addresses
                for (uint l = k + 1; l < numberOfNewValidators; l++) {
                    if (_validatorAddress == _newValidatorSetDelta.addedValidators[i].validators[l].addr) {
                        revert InvalidData("DuplicatedValidator"); // duplicate found
                    }
                }

                // TODO check for empty multisig and fee addresses
                // not checking validator signatures in the first version

                // uint8 _chainType;

                // for (uint256 n = 0; n < _numberOfRegisteredChains; n++) {
                //     if (_chains[l].id == _validatorSet[i].chainId) {
                //         _chainType = _chains[l].chainType;
                //     }
                // }

                // ValidatorAddressChainData calldata validatorData = _validatorSet[i].validators[j];
                // validateSignatures(
                //     _chainType,
                //     _validatorAddress,
                //     validatorData.keySignature,
                //     validatorData.keyFeeSignature,
                //     validatorData.data
                // );
            }
        }
    }

    /// @dev Validates key and fee signatures based on chain type.
    function validateSignatures(
        uint8 _chainType,
        address _sender,
        bytes calldata _keySignature,
        bytes calldata _keyFeeSignature,
        ValidatorChainData calldata _validatorChainData
    ) public view {
        bytes32 messageHashBytes32 = keccak256(abi.encodePacked("Hello world of apex-bridge:", _sender));

        if (_chainType == 0) {
            bytes memory messageHashBytes = _bytes32ToBytesAssembly(messageHashBytes32);
            if (
                !isSignatureValid(messageHashBytes, _keySignature, _validatorChainData.key[0], false) ||
                !isSignatureValid(messageHashBytes, _keyFeeSignature, _validatorChainData.key[1], false)
            ) {
                revert InvalidSignature();
            }
        } else if (_chainType == 1) {
            if (!isBlsSignatureValid(messageHashBytes32, _keySignature, _validatorChainData.key)) {
                revert InvalidSignature();
            }
        } else {
            revert InvalidData("chainType");
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

    function _removeOldValidatorsData(Chain[] calldata _chains) internal {
        if (newValidatorSetDelta.removedValidators.length == 0) return;

        address[] memory _validatorAddressesToRemove = newValidatorSetDelta.removedValidators;

        // Mark validator addresses as removed
        for (uint i = 0; i < _validatorAddressesToRemove.length; i++) {
            address addr = _validatorAddressesToRemove[i];
            if (addressValidatorIndex[addr] != 0) {
                addressValidatorIndex[addr] = 0;
            }
        }

        // Create temp array with remaining addresses and reset mapping indexes
        uint8 _newIndex = 0;
        uint256 _oldValidatorsCount = validatorAddresses.length;
        uint[] memory _oldIndexMap = new uint[](_oldValidatorsCount); // map new => old index

        for (uint i = 0; i < _oldValidatorsCount; i++) {
            address addr = validatorAddresses[i];
            if (addressValidatorIndex[addr] != 0) {
                validatorAddresses[i] = addr;
                addressValidatorIndex[addr] = _newIndex + 1;
                _oldIndexMap[_newIndex] = i;
                _newIndex++;
            }
        }

        // pop old addresses
        for (uint i = _newIndex; i < _oldValidatorsCount; i++) {
            validatorAddresses.pop();
        }

        // Compact chainData for each chainId
        uint256 chainsLenght = _chains.length;
        for (uint i = 0; i < chainsLenght; i++) {
            uint8 _chainId = _chains[i].id;

            for (uint j = 0; j < _newIndex; j++) {
                chainData[_chainId][j] = chainData[_chainId][_oldIndexMap[j]];
            }

            for (uint j = _newIndex; j < _oldValidatorsCount; j++) {
                chainData[_chainId].pop();
            }
        }

        validatorsCount = uint8(validatorAddresses.length);
    }

    function submitNewValidatorSet(NewValidatorSetDelta calldata _newValidatorSetDelta, Chain[] calldata chains) external onlyBridge {
        //TODO: check if these validators are indeed in the current set???
        _validateValidatorSet(_newValidatorSetDelta, chains);

        newValidatorSetDelta = _newValidatorSetDelta;

        newValidatorSetPending = true;
    }

    function validatorSetUpdated(Chain[] calldata chains) external onlyBridge {
        _removeOldValidatorsData(chains);
        _addNewValidatorsData();
        delete newValidatorSetDelta;
        newValidatorSetPending = false;
        currentValidatorSetId++;

    }

    /// @notice Adds newly proposed validators to the current validator set across all chains.
    /// @dev
    /// - Updates `validatorsCount` to include the new validators.
    /// - Ensures no duplicate validator addresses are added by checking `addressValidatorIndex`.
    /// - Appends new validator addresses to `validatorAddresses` and updates their index mapping.
    /// - Updates chain-specific validator data (`chainData`) for each chain in the new validator set delta.
    /// - Increments `currentValidatorSetId` to reflect the updated validator set.
    function _addNewValidatorsData() internal {
        if (newValidatorSetDelta.addedValidators.length != 0) {
            uint256 _numberOfNewValidators = newValidatorSetDelta.addedValidators[0].validators.length;
            uint256 _numberOfOldValidators = validatorAddresses.length;
            validatorsCount = uint8(_numberOfOldValidators + _numberOfNewValidators);

            for (uint8 i; i < _numberOfNewValidators; i++) {
                address _validatorAddress = newValidatorSetDelta.addedValidators[0].validators[i].addr;
                if (addressValidatorIndex[_validatorAddress] != 0) {
                    revert InvalidData("DuplicatedValidator");
                }
                validatorAddresses.push(_validatorAddress);
                addressValidatorIndex[_validatorAddress] = uint8(_numberOfOldValidators + i + 1);
            }

            uint256 _numberOfChains = newValidatorSetDelta.addedValidators.length;
            for (uint8 i; i < _numberOfChains; i++) {
                if (newValidatorSetDelta.addedValidators[i].chainId == 255) {
                    continue;
                }
                ValidatorSet memory _validatorSet = newValidatorSetDelta.addedValidators[i];

                for (uint8 k; k < _numberOfNewValidators; k++) {
                    chainData[_validatorSet.chainId].push(_validatorSet.validators[k].data);
                }
            }
        }
    }

    function getNewValidatorSetDelta() external view returns (NewValidatorSetDelta memory) {
        if (!newValidatorSetPending) {
            revert NoNewValidatorSetPending();
        }
        return newValidatorSetDelta;
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
        return "1.1.0";
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
