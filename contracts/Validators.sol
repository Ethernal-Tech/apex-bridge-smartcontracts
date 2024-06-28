// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract Validators is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // slither-disable too-many-digits
    address constant PRECOMPILE = 0x0000000000000000000000000000000000002050;
    uint32 constant PRECOMPILE_GAS = 50000;

    address private bridgeAddress;

    // BlockchainId -> validator address -> ValidatorCardanoData
    mapping(uint8 => mapping(address => ValidatorCardanoData)) private validatorsCardanoDataPerAddress;
    // BlockchainId -> ValidatorCardanoData[]
    mapping(uint8 => ValidatorCardanoData[]) private validatorsCardanoData;

    // keep validatorsArrayAddresses because maybe
    address[] private validatorsAddresses;
    // mapping in case they could be added/removed
    mapping(address => uint256) private addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        for (uint i; i < _validators.length; i++) {
            addressValidatorIndex[_validators[i]] = i + 1;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
    }

    function isValidator(address _addr) public view returns (bool _isValidator) {
        return addressValidatorIndex[_addr] != 0;
    }

    function isSignatureValid(
        uint8 _chainId,
        bytes memory _txRaw,
        bytes memory _signature,
        bytes memory _signatureFee,
        address _validatorAddr
    ) public view returns (bool) {
        ValidatorCardanoData memory dt = validatorsCardanoDataPerAddress[_chainId][_validatorAddr];
        return
            _isSignatureValid(_txRaw, _signature, dt.verifyingKey, true) &&
            _isSignatureValid(_txRaw, _signatureFee, dt.verifyingKeyFee, true);
    }

    function setValidatorsCardanoData(
        uint8 _chainId,
        ValidatorAddressCardanoData[] calldata _validatorAddressCardanoData
    ) external onlyBridge {
        uint256 _validatorAddressCardanoDataLength = _validatorAddressCardanoData.length;
        if (validatorsCount != _validatorAddressCardanoDataLength) {
            revert InvalidData("validators count");
        }
        // set validator cardano data for each validator
        for (uint i; i < _validatorAddressCardanoDataLength; i++) {
            ValidatorAddressCardanoData calldata dt = _validatorAddressCardanoData[i];
            validatorsCardanoDataPerAddress[_chainId][dt.addr] = dt.data;
        }
        _updateValidatorCardanoData(_chainId);
    }

    function addValidatorCardanoData(
        uint8 _chainId,
        address _addr,
        ValidatorCardanoData calldata _data
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
        validatorsCardanoDataPerAddress[_chainId][_addr] = _data;
        _updateValidatorCardanoData(_chainId);
    }

    function getValidatorsCardanoData(
        uint8 _chainId
    ) external view returns (ValidatorCardanoData[] memory _validatorsCardanoData) {
        return validatorsCardanoData[_chainId];
    }

    function getQuorumNumberOfValidators() external view returns (uint8 _quorum) {
        // return (validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1); is same as (A + B - 1) / B
        assembly {
            _quorum := div(add(mul(sload(validatorsCount.slot), 2), 2), 3)
        }
        return _quorum;
    }

    function _updateValidatorCardanoData(uint8 _chainId) internal {
        // validatorsCardanoDataPerAddress must be set for all the validator addresses
        uint cnt = 0;
        uint256 validatorsAddressesLength = validatorsAddresses.length;
        for (uint i; i < validatorsAddressesLength; i++) {
            if (validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]].verifyingKey != "") {
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
        bytes memory _txRaw,
        bytes memory _signature,
        bytes32 _verifyingKey,
        bool _isTx
    ) internal view returns (bool) {
        // solhint-disable-line avoid-low-level-calls
        (bool callSuccess, bytes memory returnData) = PRECOMPILE.staticcall{gas: PRECOMPILE_GAS}(
            abi.encode(_txRaw, _signature, _verifyingKey, _isTx)
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
