// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

/// @title BridgingAddresses Contract
/// @notice Manages bridging addresses for registered chains.
/// @dev Upgradeable using OpenZeppelin UUPS proxy pattern.
contract BridgingAddresses is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;

    /// @notice Mapping of chain IDs to the number of configured bridge addresses for each chain.
    mapping(uint8 => uint8) public bridgingAddressesCount;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

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
    function setDependencies(address _bridgeAddress) external onlyOwner {
        if (!_isContract(_bridgeAddress)) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
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
    function checkBridgingAddrIndex(uint8 chainId, uint8 bridgeAddrIndex) external view returns (bool) {
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
}
