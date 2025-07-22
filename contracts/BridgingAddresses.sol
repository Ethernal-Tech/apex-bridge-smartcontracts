// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

contract BridgingAddresses is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;

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

    function initRegisteredChains(Chain[] calldata registeredChains) external onlyBridge {
        for (uint8 i; i < registeredChains.length; i++) {
            _initRegisteredChain(registeredChains[i]);
        }
    }

    function initRegisteredChain(Chain calldata registeredChain) external onlyBridge {
        _initRegisteredChain(registeredChain);
    }

    function _initRegisteredChain(Chain calldata registeredChain) internal {
        if (bridgingAddressesCount[registeredChain.id] == 0) {
            // Initialize the count to 1 if not already set (acts as default value)
            bridgingAddressesCount[registeredChain.id] = 1;
        } else {
            revert BridgingAddrCountAlreadyInit(registeredChain.id);
        }
    }

    function updateBridgingAddrsCount(uint8 _chainId, uint8 _bridgingAddrsCount) external onlyBridge {
        if (_bridgingAddrsCount == 0) revert InvalidBridgingAddrCount(_chainId, _bridgingAddrsCount);
        bridgingAddressesCount[_chainId] = _bridgingAddrsCount;
    }

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
