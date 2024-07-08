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

    // BlockchainId -> validator address -> ValidatorChainData
    mapping(uint8 => mapping(address => ValidatorChainData)) private chainDataPerAddress;
    // BlockchainId -> ValidatorChainData[]
    mapping(uint8 => ValidatorChainData[]) private chainData;

    // keep validatorsArrayAddresses because maybe
    address[] private validatorsAddresses;
    // mapping in case they could be added/removed
    mapping(address => uint8) private addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address[] calldata _validators) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        for (uint8 i; i < _validators.length; i++) {
            addressValidatorIndex[_validators[i]] = i + 1;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
    }

    function isValidator(address _addr) public view returns (bool) {
        return addressValidatorIndex[_addr] != 0;
    }

    function getValidatorIndex(address _addr) public view returns (uint8) {
        return addressValidatorIndex[_addr];
    }

    function isSignatureValid(
        uint8 _chainId,
        bytes calldata _txRaw,
        bytes calldata _signature,
        bytes calldata _signatureFee,
        address _validatorAddr
    ) public view returns (bool) {
        uint256[4] memory key = chainDataPerAddress[_chainId][_validatorAddr].key;
        return
            _isSignatureValid(_txRaw, _signature, key[0], true) && // multisig verification key
            _isSignatureValid(_txRaw, _signatureFee, key[1], true); // fee verification key
    }

    function isBlsSignatureValid(
        uint8 _chainId,
        bytes calldata _txRaw,
        bytes calldata _signature,
        address _validatorAddr
    ) public view returns (bool) {
        return _isBlsSignatureValid(_txRaw, _signature, chainDataPerAddress[_chainId][_validatorAddr].key, true);
    }

    function setValidatorsChainData(
        uint8 _chainId,
        ValidatorAddressChainData[] calldata _chainDatas
    ) external onlyBridge {
        uint256 _length = _chainDatas.length;
        if (validatorsCount != _length) {
            revert InvalidData("validators count");
        }
        // set validator chain data for each validator
        for (uint i; i < _length; i++) {
            ValidatorAddressChainData calldata dt = _chainDatas[i];
            chainDataPerAddress[_chainId][dt.addr] = dt.data;
        }
        _updateValidatorChainData(_chainId);
    }

    function addValidatorChainData(
        uint8 _chainId,
        address _addr,
        ValidatorChainData calldata _data
    ) external onlyBridge {
        chainDataPerAddress[_chainId][_addr] = _data;
        _updateValidatorChainData(_chainId);
    }

    function getValidatorsChainData(uint8 _chainId) external view returns (ValidatorChainData[] memory) {
        return chainData[_chainId];
    }

    function getQuorumNumberOfValidators() external view returns (uint8 _quorum) {
        // return (validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1); is same as (A + B - 1) / B
        assembly {
            _quorum := div(add(mul(sload(validatorsCount.slot), 2), 2), 3)
        }
        return _quorum;
    }

    function _updateValidatorChainData(uint8 _chainId) internal {
        // chainDataPerAddress must be set for all the validator addresses
        uint cnt = 0;
        uint256 validatorsAddressesLength = validatorsAddresses.length;
        for (uint i; i < validatorsAddressesLength; i++) {
            ValidatorChainData memory vcd = chainDataPerAddress[_chainId][validatorsAddresses[i]];
            if (vcd.key[0] != 0 || vcd.key[1] != 0 || vcd.key[2] != 0 || vcd.key[3] != 0) {
                cnt++;
            }
        }
        if (cnt != validatorsAddressesLength) {
            return;
        }

        delete chainData[_chainId];
        for (uint i; i < validatorsAddressesLength; i++) {
            chainData[_chainId].push(chainDataPerAddress[_chainId][validatorsAddresses[i]]);
        }
    }

    function _isSignatureValid(
        bytes calldata _data,
        bytes calldata _signature,
        uint256 _verifyingKey,
        bool _isTx
    ) internal view returns (bool) {
        // solhint-disable-line avoid-low-level-calls
        (bool callSuccess, bytes memory returnData) = PRECOMPILE.staticcall{gas: PRECOMPILE_GAS}(
            abi.encode(_data, _signature, _verifyingKey, _isTx)
        );

        return callSuccess && abi.decode(returnData, (bool));
    }

    function _isBlsSignatureValid(
        bytes calldata _data,
        bytes calldata _signature,
        uint256[4] memory _verifyingKey,
        bool _isTx
    ) internal pure returns (bool) {
        // TODO: call bls verification precompile
        // just some random jiberish which should evaluate to true to silence compiler
        uint256 a = _data.length + _signature.length + _verifyingKey[0] + (_isTx ? 1 : 0);
        return a != 0;
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
