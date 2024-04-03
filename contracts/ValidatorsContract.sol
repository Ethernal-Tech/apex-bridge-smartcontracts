// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";

contract ValidatorsContract is IBridgeContractStructs {
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

    function setCardanoData(
        string calldata _chainId,
        address addr,
        ValidatorCardanoData calldata data
    ) external onlyBridgeContract {
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
            if (bytes(validatorsCardanoDataPerAddress[_chainId][validatorsAddresses[i]].keyHash).length > 0) {
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

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }
}
