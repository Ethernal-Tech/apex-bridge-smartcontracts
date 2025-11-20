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
    /// @dev blade apex-bridge fake chain id
    uint8 constant BLADE_CHAIN_ID = 255;

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
    uint256[45] private __gap;

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
            validatorAddresses.push(_validators[i]);
        }
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

    /// @notice Sets the external contract dependencies.
    /// @dev This function can only be called by the upgrade admin. It verifies that the provided address is a contract.
    /// @param _validators Current list of validator addresses
    function setAdditionalDependenciesAndSync(address[] calldata _validators) external onlyUpgradeAdmin {
        delete validatorAddresses;
        for (uint8 i; i < _validators.length; i++) {
            validatorAddresses.push(_validators[i]);
        }
    }

    function setFixedDataForTestNet() external onlyUpgradeAdmin {
        delete validatorAddresses;
        validatorsCount = 4;
        validatorAddresses.push(0x4864fa00a8eb9524374e661759dC896783692c1A);
        validatorAddresses.push(0x95227572e2f990506B57637D50e4cf11e16ab7C3);
        validatorAddresses.push(0xfd0926b6aAbcb4B1EA7CE3Bff9B5475dC727eB14);
        validatorAddresses.push(0xF2a47F6eD224BC882f20651eC55b1Ff2bb8509Fa);
        addressValidatorIndex[0x4864fa00a8eb9524374e661759dC896783692c1A] = 0;
        addressValidatorIndex[0x95227572e2f990506B57637D50e4cf11e16ab7C3] = 1;
        addressValidatorIndex[0xfd0926b6aAbcb4B1EA7CE3Bff9B5475dC727eB14] = 2;
        addressValidatorIndex[0xF2a47F6eD224BC882f20651eC55b1Ff2bb8509Fa] = 3;
        // ChainIDIntPrime  = chainIDNum(1)
        // ChainIDIntVector = chainIDNum(2)
        // ChainIDIntNexus  = chainIDNum(3)
        delete chainData[1];
        delete chainData[2];
        delete chainData[3];
        // nexus
        chainData[3].push(
            ValidatorChainData({
                key: [
                    uint256(0x2e0e24c05effaee471e75bb8f3cfd7def81b0deab163faccb2980e7c974d0998),
                    uint256(0x174a2fae79b3ecd9934b2f8ee745d5cb5310a815b8f7119b645e02d0224c3cc3),
                    uint256(0x24b96ba6444bb3b5fcc5344e842cfd2706434e3664327fdd075a1cd87c8bbc7),
                    uint256(0xdb40a376555167cbe50d581676b01b5cadb22f53eddbc0669fe7daff4c26afc)
                ]
            })
        );
        chainData[3].push(
            ValidatorChainData({
                key: [
                    uint256(0x154208c3970c7ada74877ab33d4f1aa2142c00dfbfb63826aca65f19e748f523),
                    uint256(0x2ea0b69f24a59ffe94282f906261f32b83afc61dc50932f28b7cdb3674f37b1c),
                    uint256(0x14c216b9fe7124db38ac7436cd5f87b74d862d4a91f721b4d432b2ba48a5372b),
                    uint256(0x2ba06c1d0e93f2199a1e9e3d7767219f71839b8325ee712bbda361faa029773c)
                ]
            })
        );
        chainData[3].push(
            ValidatorChainData({
                key: [
                    uint256(0x6c686eea9c86e94df0aed22004c85205f4dda9539f9da2e8c4c2f6fdb82375d),
                    uint256(0xdc8d05a9315a92adc4a797549f5b3da1a91959b152ef42717755f45082db899),
                    uint256(0x6e9c2c5ad7cc6b61116b212d0acb858c13c8e943199986caf9aa95674f22fca),
                    uint256(0xbe387071bed3ef756689fb174b641cbf982c38eb72ddaebd6fd8410a975b3d9)
                ]
            })
        );
        chainData[3].push(
            ValidatorChainData({
                key: [
                    uint256(0x175ecff71bc3a80837ca5d47d4d86a131b43261ae44527de4f30fa23a29bc92d),
                    uint256(0x2f30c5bf010acc6eabce0bdac2b57f3e8b434f8a82b592ece1b4f82158602e0b),
                    uint256(0xd508f845f66cb7dc0fff55615fc5380262297028eaf0cb96d70a143ba046ac2),
                    uint256(0x1533810e7eea1b231bcf57af22cf2ae3df8eabb57256687eb25e2b9e448a8e90)
                ]
            })
        );
        // prime
        chainData[1].push(
            ValidatorChainData({
                key: [
                    uint256(0x3a984a4dc072e6d91860dbc1e4bc96bc1895147b55ab1e4f17e6f9de84e6235e),
                    uint256(0x42cf6508b42247db0c81431f2505760e3e6b5aa816529fc58f076e9943704b5f),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[1].push(
            ValidatorChainData({
                key: [
                    uint256(0x275cec5f62b5ed26d0b841ad2b57089cb7c1d504f165ec139f9c800c6ede96f1),
                    uint256(0xfd710e86154c8e2aed9b785417242f08c7cc84f9898277f61c5e0500085bd9bc),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[1].push(
            ValidatorChainData({
                key: [
                    uint256(0xbfc5c53bb8e938d65637c336f65fed78c2b0625fc6dbdee04755c075fe7e062c),
                    uint256(0x7ad40538647459f8285f2da444ba5971ce018cb0a32df88c75fc3c09ca098c62),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[1].push(
            ValidatorChainData({
                key: [
                    uint256(0x6bd45cfb62c2ea7467d0bf836d15b4484c9fcbbc22af9b70746dca019ea149b7),
                    uint256(0x1b068bf2ad21e90be7cc975b5fe003ffbc3b6ac23775ac8baa99a2a8679f8825),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        // vector
        chainData[2].push(
            ValidatorChainData({
                key: [
                    uint256(0x6271ead2582ab65ebbc548251ebb42c61b60bcbc80e9b1d05adf9518f1e2fdab),
                    uint256(0x48eb76a87b68a76bfc6a13c7f353886afda54709b0532c3aa48ce382083f17a9),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[2].push(
            ValidatorChainData({
                key: [
                    uint256(0x48607a32a1d39e3bc81ff832945f4d311f1ea829a2ae9899b8de9092b6cae40a),
                    uint256(0xa6721339120064939a6c851f04b9a83ca5f8e351f856ebec5cddc780e5d4f90f),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[2].push(
            ValidatorChainData({
                key: [
                    uint256(0x7201890d007c29cd352bc985a668c19a98acb8c8807dde6a817612ad3e891cda),
                    uint256(0xcfae7d93b94491bef9658d82bc77028a5fe0c56ad5a50dcd30f83379c9e7c4ed),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
        chainData[2].push(
            ValidatorChainData({
                key: [
                    uint256(0x0e3d522ff2e6f1282d6c038a0205bf65bf36d016681416e4144db9d8b5fe50e3),
                    uint256(0x0c158a74532baaa0bf9b9ab5bea0f80d590ca844d11956f2e6cabd8095710c26),
                    uint256(0),
                    uint256(0)
                ]
            })
        );
    }

    function isValidator(address _addr) public view returns (bool) {
        return addressValidatorIndex[_addr] != 0;
    }

    function getValidatorIndex(address _addr) public view returns (uint8) {
        return addressValidatorIndex[_addr];
    }

    function getValidatorsAddresses() public view returns (address[] memory) {
        return validatorAddresses;
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
            bool chainMatched = false;
            // checks that there is a new validator set for all registered chains
            // and for Blade -> chainId == 255
            for (uint256 j; j < _numberOfRegisteredChains; j++) {
                if (
                    _newValidatorSetDelta.addedValidators[i].chainId != _chains[j].id &&
                    _newValidatorSetDelta.addedValidators[i].chainId != BLADE_CHAIN_ID
                ) {
                    continue;
                }
                chainMatched = true; // This validator matches the chain
            }

            if (!chainMatched) {
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
                validatorAddresses[_newIndex] = addr;
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
        uint256 chainsLength = _chains.length;
        for (uint i = 0; i < chainsLength; i++) {
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

    function submitNewValidatorSet(
        NewValidatorSetDelta calldata _newValidatorSetDelta,
        Chain[] calldata chains
    ) external onlyBridge {
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
                if (newValidatorSetDelta.addedValidators[i].chainId == BLADE_CHAIN_ID) {
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
        return "1.1.1";
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
