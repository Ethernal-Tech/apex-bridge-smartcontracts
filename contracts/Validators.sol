// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract Validators is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // slither-disable too-many-digits
    address constant PRECOMPILE = 0x0000000000000000000000000000000000002050;
    uint256 constant PRECOMPILE_GAS = 150000;

    address private bridgeAddress;

    // BlockchainID -> validator address -> ValidatorCardanoData
    mapping(string => mapping(address => ValidatorCardanoData)) private validatorsCardanoDataPerAddress;
    // BlockchainID -> ValidatorCardanoData[]
    mapping(string => ValidatorCardanoData[]) private validatorsCardanoData;

    // keep validatorsArrayAddresses because maybe
    address[] private validatorsAddresses;
    // mapping in case they could be added/removed
    mapping(address => bool) private isAddressValidator;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        for (uint i; i < _validators.length; i++) {
            isAddressValidator[_validators[i]] = true;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
    }

    function isValidator(address addr) public view returns (bool) {
        return isAddressValidator[addr];
    }

    function isSignatureValid(
        string calldata _chainId,
        string calldata _txRaw,
        string calldata _signature,
        string calldata _signatureFee,
        address _validatorAddr
    ) public view returns (bool) {
        ValidatorCardanoData memory dt = validatorsCardanoDataPerAddress[_chainId][_validatorAddr];
        return
            _isSignatureValid(_txRaw, _signature, dt.verifyingKey, true) &&
            _isSignatureValid(_txRaw, _signatureFee, dt.verifyingKeyFee, true);
    }

    function setValidatorsCardanoData(
        string calldata _chainId,
        ValidatorAddressCardanoData[] calldata validatorAddressCardanoData
    ) external onlyBridge {
        if (validatorsCount != validatorAddressCardanoData.length) {
            revert InvalidData("validators count");
        }
        // set validator cardano data for each validator
        for (uint i; i < validatorAddressCardanoData.length; i++) {
            ValidatorAddressCardanoData calldata dt = validatorAddressCardanoData[i];
            validatorsCardanoDataPerAddress[_chainId][dt.addr] = dt.data;
        }
        _updateValidatorCardanoData(_chainId);
    }

    function addValidatorCardanoData(
        string calldata _chainId,
        address addr,
        ValidatorCardanoData calldata data
    ) external onlyBridge {
        // We dont have enough stack to validate signatures bellow
        // but if validator does not provide valid keys he will not be able to send batches
        // so i think we are good without these checks. will left them for historical reason
        // if (!_isSignatureValid(REGISTRATION_MESSAGE, _validationSignature, data.verifyingKey, false)) {
        //     revert InvalidSignature();
        // }
        // if (!_isSignatureValid(REGISTRATION_MESSAGE, _validationSignatureFee, data.verifyingKeyFee, false)) {
        //     revert InvalidSignature();
        // }
        validatorsCardanoDataPerAddress[_chainId][addr] = data;
        _updateValidatorCardanoData(_chainId);
    }

    function getValidatorsCardanoData(string calldata _chainId) external view returns (ValidatorCardanoData[] memory) {
        return validatorsCardanoData[_chainId];
    }

    function getQuorumNumberOfValidators() external view returns (uint8) {
        // return (validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1); is same as (A + B - 1) / B
        return (validatorsCount * 2 + 2) / 3;
    }

    function getValidatorsCount() external view returns (uint8) {
        return validatorsCount;
    }

    function _updateValidatorCardanoData(string calldata _chainId) internal {
        // validatorsCardanoDataPerAddress must be set for all the validator addresses
        uint cnt = 0;
        uint256 validatorsAddressesLength = validatorsAddresses.length;
        for (uint i; i < validatorsAddressesLength; i++) {
            if (bytes(validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]].verifyingKey).length > 0) {
                cnt++;
            }
        }

        if (cnt != validatorsAddressesLength) {
            return;
        }

        delete validatorsCardanoData[_chainId];
        for (uint i; i < validatorsAddressesLength; i++) {
            validatorsCardanoData[_chainId].push(validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]]);
        }
    }

    function _isSignatureValid(
        string calldata message,
        string calldata signature,
        string memory verifyingKey,
        bool isTx
    ) internal view returns (bool) {
        // solhint-disable-line avoid-low-level-calls
        (bool callSuccess, bytes memory returnData) = PRECOMPILE.staticcall{gas: PRECOMPILE_GAS}(
            abi.encode(message, signature, verifyingKey, isTx)
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
