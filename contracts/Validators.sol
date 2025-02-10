// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract Validators is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    // slither-disable too-many-digits
    address constant PRECOMPILE = 0x0000000000000000000000000000000000002050;
    uint32 constant PRECOMPILE_GAS = 50000;
    address constant VALIDATOR_BLS_PRECOMPILE = 0x0000000000000000000000000000000000002060;
    uint256 constant VALIDATOR_BLS_PRECOMPILE_GAS = 50000;

    address private bridgeAddress;

    // BlockchainId -> ValidatorChainData[]
    mapping(uint8 => ValidatorChainData[]) private chainData;
    // validator address index(+1) in chainData mapping
    mapping(address => uint8) private addressValidatorIndex;

    uint8 public validatorsCount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin, address[] calldata _validators) public initializer {
        _transferOwnership(_owner);
        upgradeAdmin = _upgradeAdmin;
        for (uint8 i; i < _validators.length; i++) {
            addressValidatorIndex[_validators[i]] = i + 1;
        }
        validatorsCount = uint8(_validators.length);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

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

        uint8 indx = addressValidatorIndex[_addr] - 1;
        chainData[_chainId][indx] = _data;
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

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
