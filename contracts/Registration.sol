// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Bridge.sol";
import "./BridgingAddresses.sol";
import "./ChainTokens.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Utils.sol";
import "./Validators.sol";

/// @title Registration
/// @notice Registration of chains and tokens.
/// @dev UUPS upgradeable and modular via dependency contracts (Bridge, BridgingAddresses, ChainTokens, Claims, ClaimsHelper, Validators).
contract Registration is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    Bridge private bridge;
    BridgingAddresses private bridgingAddresses;
    ChainTokens private chainTokens;
    Claims private claims;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    /// @notice Array of registered chains.
    Chain[] private chains;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

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
    /// @param _bridgeAddress Address of Bridge contract.
    /// @param _bridgingAddressesAddress Address of BridgingAddresses contract.
    /// @param _chainTokensAddress Address of ChainTokens contract.
    /// @param _claimsAddress Address of Claims contract.
    /// @param _claimsHelperAddress Address of ClaimsHelper contract.
    /// @param _validatorsAddress Address of Validators contract.
    function setDependencies(
        address _bridgeAddress,
        address _bridgingAddressesAddress,
        address _chainTokensAddress,
        address _claimsAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_bridgeAddress) ||
            !_isContract(_bridgingAddressesAddress) ||
            !_isContract(_chainTokensAddress) ||
            !_isContract(_claimsAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        bridge = Bridge(_bridgeAddress);
        bridgingAddresses = BridgingAddresses(_bridgingAddressesAddress);
        chainTokens = ChainTokens(_chainTokensAddress);
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Set additional metadata for a chain, such as multisig and fee payer addresses.
    /// @param _chainId The target chain ID.
    /// @param addressMultisig Multisig address associated with the chain.
    /// @param addressFeePayer Fee payer address used for covering transaction costs.
    function setChainAdditionalData(
        uint8 _chainId,
        string calldata addressMultisig,
        string calldata addressFeePayer
    ) external onlyBridge {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }
        uint8 _chainsLength = uint8(chains.length);
        for (uint8 i = 0; i < _chainsLength; i++) {
            if (chains[i].id == _chainId) {
                chains[i].addressMultisig = addressMultisig;
                chains[i].addressFeePayer = addressFeePayer;
                break;
            }
        }
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
    ) public onlyBridge {
        if (_chain.id == 0) {
            revert InvalidData("InvalidChainId");
        }

        uint256 _validatorAddressChainDataLength = _validatorData.length;

        if (_validatorAddressChainDataLength < 4) {
            revert InvalidData("ValidatorAddressChainData");
        }

        uint8 _chainType = _chain.chainType;

        for (uint i = 0; i < _validatorAddressChainDataLength; i++) {
            address _validatorAddress = _validatorData[i].addr;

            if (_validatorAddress == address(0)) {
                revert ZeroAddress();
            }

            _validateSignatures(
                _chainType,
                _validatorAddress,
                _validatorData[i].keySignature,
                _validatorData[i].keyFeeSignature,
                _validatorData[i].data
            );
        }

        uint8 _chainId = _chain.id;

        validators.setValidatorsChainData(_chainId, _validatorData);

        if (!claims.isChainRegistered(_chainId)) {
            chains.push(_chain);
            claims.setChainRegistered(_chainId, _tokenQuantity, _wrappedTokenQuantity);
            bridgingAddresses.initRegisteredChain(_chainId);
            emit newChainRegistered(_chainId);
        }
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
        bytes calldata _keyFeeSignature,
        address _caller
    ) external onlyBridge {
        if (_chainId == 0) {
            revert InvalidData("InvalidChainId");
        }

        if (claims.isChainRegistered(_chainId)) {
            revert ChainAlreadyRegistered(_chainId);
        }

        bytes32 chainHash = keccak256(abi.encode(_chainId, _chainType, _tokenQuantity));

        if (claimsHelper.hasVoted(chainHash, validators.getValidatorIndex(_caller) - 1)) {
            revert AlreadyProposed(_chainId);
        }

        _validateSignatures(_chainType, _caller, _keySignature, _keyFeeSignature, _validatorChainData);

        validators.addValidatorChainData(_chainId, _caller, _validatorChainData);

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;

        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(_validatorIdx, chainHash, validators.validatorsCount())
        ) {
            chains.push(Chain(_chainId, _chainType, "", ""));

            claims.setChainRegistered(_chainId, _tokenQuantity, _wrappedTokenQuantity);
            bridgingAddresses.initRegisteredChain(_chainId);
            emit newChainRegistered(_chainId);
        } else {
            emit newChainProposal(_chainId, _caller);
        }
    }

    /// @dev Validates key and fee signatures based on chain type.
    function _validateSignatures(
        uint8 _chainType,
        address _sender,
        bytes calldata _keySignature,
        bytes calldata _keyFeeSignature,
        ValidatorChainData calldata _validatorChainData
    ) internal view {
        bytes32 messageHashBytes32 = keccak256(abi.encodePacked("Hello world of apex-bridge:", _sender));

        if (_chainType == 0) {
            bytes memory messageHashBytes = _bytes32ToBytesAssembly(messageHashBytes32);
            if (
                !validators.isSignatureValid(messageHashBytes, _keySignature, _validatorChainData.key[0], false) ||
                !validators.isSignatureValid(messageHashBytes, _keyFeeSignature, _validatorChainData.key[1], false)
            ) {
                revert InvalidSignature();
            }
        } else if (_chainType == 1) {
            if (!validators.isBlsSignatureValid(messageHashBytes32, _keySignature, _validatorChainData.key)) {
                revert InvalidSignature();
            }
        } else {
            revert InvalidData("chainType");
        }
    }

    function addChain(Chain calldata _chain) external onlyBridge {
        chains.push(_chain);
    }

    function getAllRegisteredChains() external view returns (Chain[] memory _chains) {
        return chains;
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
        return "1.0.0";
    }

    modifier onlyBridge() {
        if (msg.sender != address(bridge)) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }
}
