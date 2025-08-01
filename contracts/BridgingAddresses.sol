// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/TransactionTypesLib.sol";
import "./Utils.sol";
import "./Claims.sol";

/// @title BridgingAddresses Contract
/// @notice Manages bridging addresses for registered chains.
/// @dev Upgradeable using OpenZeppelin UUPS proxy pattern.
contract BridgingAddresses is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;
    Claims private claims;

    /// @notice Mapping of chain IDs to the number of configured bridge addresses for each chain.
    mapping(uint8 => uint8) public bridgingAddressesCount;

    /// @notice Tracks whether a specific bridging address has been delegated to a stake pool on a given chain.
    /// @dev Mapping: chainId => bridgeAddrIndex => true if delegated, false otherwise.
    mapping(uint8 => mapping(uint8 => bool)) public isAddrDelegatedToStake;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[48] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract.
    /// @param _owner The address to be set as the contract owner.
    /// @param _upgradeAdmin The address authorized to perform upgrades.
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _bridgeAddress The address of the bridge contract
    function setDependencies(address _bridgeAddress, address _claimsAddress) external onlyOwner {
        if (!_isContract(_bridgeAddress)) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claims = Claims(_claimsAddress);
    }

    /// @notice Initializes the mapping of registered chains and their bridge address counts.
    /// @dev Can only be called by the authorized bridge contract.
    /// @param registeredChains An array of chain configuration structs.
    function initRegisteredChains(Chain[] calldata registeredChains) external onlyBridge {
        for (uint8 i; i < registeredChains.length; i++) {
            _initRegisteredChain(registeredChains[i].id);
        }
    }

    /// @notice Initializes a single registered chain’s bridging address count.
    /// @dev Can only be called by the bridge. Fails if already initialized.
    /// @param _chainId registered chain id
    function initRegisteredChain(uint8 _chainId) external onlyBridge {
        _initRegisteredChain(_chainId);
    }

    function _initRegisteredChain(uint8 _chainId) internal {
        // Initialize the count to 1 if not already set (acts as default value)
        if (bridgingAddressesCount[_chainId] != 0) {
            revert BridgingAddrCountAlreadyInit(_chainId);
        }
        bridgingAddressesCount[_chainId] = 1;
    }

    /// @notice Records a stake delegation transaction for a specific bridging address on a given chain.
    /// @dev Reverts if the address is already delegated or the chain is not registered.
    /// @param chainId The ID of the chain where the delegation is made.
    /// @param bridgeAddrIndex The index of the bridging address being delegated.
    /// @param stakePoolId The identifier of the stake pool to delegate to. Should be at least 56 bytes long
    /// @param transactionSubType The type of transaction to be executed.
    function stakeAddressOperation(
        uint8 chainId,
        uint8 bridgeAddrIndex,
        string calldata stakePoolId,
        uint8 transactionSubType
    ) external onlyBridge {
        if (!checkBridgingAddrIndex(chainId, bridgeAddrIndex)) {
            revert InvalidBridgeAddrIndex(chainId, bridgeAddrIndex);
        }

        // cardano stake pool id string can be: (Bech32, size=56–64, pool1...) or (Hex[raw ID], size=56)
        // for deregistration, we do not need to check the stake pool id length since it is not required field
        if (transactionSubType != TransactionTypesLib.STAKE_DEREGISTRATION && bytes(stakePoolId).length < 56) {
            revert InvalidData(stakePoolId);
        }

        // Don't allow to register the same address again
        if (transactionSubType == TransactionTypesLib.STAKE_REGISTRATION &&
            isAddrDelegatedToStake[chainId][bridgeAddrIndex]) {
            revert AddrAlreadyDelegatedToStake(chainId, bridgeAddrIndex);
        }

        // Don't allow to deregister or redelegate the address if it is not registered already
        if (transactionSubType != TransactionTypesLib.STAKE_REGISTRATION &&
            !isAddrDelegatedToStake[chainId][bridgeAddrIndex]) {
            revert AddrNotRegistered(chainId, bridgeAddrIndex);
        }

        // update the state of the address, if it is deregistration, we need to set the state to false - true otherwise
        isAddrDelegatedToStake[chainId][bridgeAddrIndex] = transactionSubType != TransactionTypesLib.STAKE_DEREGISTRATION;

        claims.createStakeTransaction(chainId, bridgeAddrIndex, stakePoolId, transactionSubType);
    }

    /// @notice this function is only for admin if stake pool registration goes wrong
    function clearIsAddrDelegatedToStake() external onlyUpgradeAdmin {
        // currently there are 4 chains and only one address
        for (uint8 _chainID = 1; _chainID < 5; _chainID++) {
            for (uint8 _indx = 0; _indx < 1; _indx++) {
                isAddrDelegatedToStake[_chainID][_indx] = false;
            }
        }
    }

    function updateBridgingAddressState(uint8 _chainId, uint8 _bridgeAddrIndex, bool _state) external onlyClaims {
        isAddrDelegatedToStake[_chainId][_bridgeAddrIndex] = _state;
    }

    /// @notice Updates the number of bridge addresses for a specific chain.
    /// @dev Only callable by the bridge contract.
    /// @param _chainId The target chain ID to update.
    /// @param _bridgingAddrsCount The new count of bridge addresses for the chain.
    function updateBridgingAddrsCount(uint8 _chainId, uint8 _bridgingAddrsCount) external onlyBridge {
        if (_bridgingAddrsCount == 0) revert InvalidBridgingAddrCount(_chainId, _bridgingAddrsCount);
        bridgingAddressesCount[_chainId] = _bridgingAddrsCount;
    }

    /// @notice Checks whether a given bridge address index is valid for a specific chain.
    /// @param chainId The ID of the chain being queried.
    /// @param bridgeAddrIndex The bridge address index to validate.
    /// @return True if the index is valid; otherwise false.
    function checkBridgingAddrIndex(uint8 chainId, uint8 bridgeAddrIndex) internal view returns (bool) {
        return bridgingAddressesCount[chainId] > bridgeAddrIndex;
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

    modifier onlyClaims() {
        if (msg.sender != address(claims)) revert NotClaims();
        _;
    }
}
