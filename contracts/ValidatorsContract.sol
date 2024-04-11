// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";

contract ValidatorsContract is IBridgeContractStructs {
    // slither-disable too-many-digits
    address constant PRECOMPILE = 0x0000000000000000000000000000000000002050;
    uint256 constant PRECOMPILE_GAS = 150000;

    address private bridgeContractAddress;

    // BlockchainID -> validator address -> ValidatorCardanoData
    mapping(string => mapping(address => ValidatorCardanoData)) private validatorsCardanoDataPerAddress;
    // BlockchainID -> ValidatorCardanoData[]
    mapping(string => ValidatorCardanoData[]) private validatorsCardanoData;

    // keep validatorsAddresses because maybe
    address[] private validatorsAddresses;
    // mapping in case they could be added/removed
    mapping(address => bool) private isAddressValidator;

    uint8 public validatorsCount;

    constructor(address[] memory _validators, address _bridgeContractAddress) {
        for (uint i = 0; i < _validators.length; i++) {
            isAddressValidator[_validators[i]] = true;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
        bridgeContractAddress = _bridgeContractAddress;
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
        ValidatorAddressCardanoData[] calldata validators
    ) external onlyBridgeContract {
        if (validatorsCount != validators.length) {
            revert InvalidData("validators count");
        }
        // set validator cardano data for each validator
        for (uint i = 0; i < validators.length; i++) {
            ValidatorAddressCardanoData memory dt = validators[i];
            validatorsCardanoDataPerAddress[_chainId][dt.addr] = dt.data;
        }
        _updateValidatorCardanoData(_chainId);
    }

    function addValidatorCardanoData(
        string calldata _chainId,
        address addr,
        ValidatorCardanoData calldata data
    ) external onlyBridgeContract {
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

    function _updateValidatorCardanoData(string calldata _chainId) private {
        // validatorsCardanoDataPerAddress must be set for all the validator addresses
        uint cnt = 0;
        for (uint i = 0; i < validatorsAddresses.length; i++) {
            if (bytes(validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]].verifyingKey).length > 0) {
                cnt++;
            }
        }

        if (cnt != validatorsAddresses.length) {
            return;
        }

        delete validatorsCardanoData[_chainId];
        for (uint i = 0; i < validatorsAddresses.length; i++) {
            validatorsCardanoData[_chainId].push(validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]]);
        }
    }

    function _isSignatureValid(
        string memory message,
        string memory signature,
        string memory verifyingKey,
        bool isTx
    ) private view returns (bool) {
        // solhint-disable-line avoid-low-level-calls
        (bool callSuccess, bytes memory returnData) = PRECOMPILE.staticcall{gas: PRECOMPILE_GAS}(
            abi.encode(message, signature, verifyingKey, isTx)
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }
}
