// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Utils.sol";
import "./Claims.sol";

/// @title Admin Contract
/// @notice Manages configuration and privileged updates for the bridge system
/// @dev UUPS upgradable contract using OpenZeppelin upgradeable framework
contract Admin is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address public fundAdmin;
    Claims private claims;

    /// @dev If true, a validator set change is in progress.
    bool public validatorChange;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the Admin contract
    /// @param _owner Address to be assigned as the contract owner
    /// @param _upgradeAdmin Address authorized to perform upgrades
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
        fundAdmin = _owner;
        validatorChange = false;
    }

    /// @notice Authorizes a new implementation for upgrade
    /// @param newImplementation Address of the new implementation contract
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _claimsAddress Address of the deployed Claims contract
    function setDependencies(address _claimsAddress) external onlyOwner {
        if (!_isContract(_claimsAddress)) revert NotContractAddress();
        claims = Claims(_claimsAddress);
    }

    /// @notice Updates token quantity for a specific chain
    /// @param _chainId ID of the chain to update
    /// @param _isIncrease Whether to increase (true) or decrease (false) the quantity
    /// @param _quantity Amount of tokens to add or subtract
    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _quantity) external onlyFundAdmin {
        claims.updateChainTokenQuantity(_chainId, _isIncrease, _quantity);
        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    /// @notice Performs a defund operation for a specific chain
    /// @param _chainId Chain ID to defund
    /// @param _defundAddress Address on destination chain to receive funds
    /// @param _amount Amount of tokens to defund
    function defund(uint8 _chainId, string calldata _defundAddress, uint256 _amount) external onlyFundAdmin {
        claims.defund(_chainId, _amount, _defundAddress);
        emit ChainDefunded(_chainId, _amount);
    }

    /// @notice Sets a new fund admin
    /// @param _fundAdmin Address of the new fund admin
    function setFundAdmin(address _fundAdmin) external onlyOwner {
        if (_fundAdmin == address(0)) revert ZeroAddress();
        fundAdmin = _fundAdmin;
        emit FundAdminChanged(_fundAdmin);
    }

    /// @notice Updates the maximum number of transactions allowed in a batch
    /// @param _maxNumberOfTransactions New maximum value
    function updateMaxNumberOfTransactions(uint16 _maxNumberOfTransactions) external onlyOwner {
        claims.updateMaxNumberOfTransactions(_maxNumberOfTransactions);
        emit UpdatedMaxNumberOfTransactions(_maxNumberOfTransactions);
    }

    /// @notice Updates the number of timeout blocks for claim finalization
    /// @param _timeoutBlocksNumber New timeout in blocks
    function updateTimeoutBlocksNumber(uint8 _timeoutBlocksNumber) external onlyOwner {
        claims.updateTimeoutBlocksNumber(_timeoutBlocksNumber);
        emit UpdatedTimeoutBlocksNumber(_timeoutBlocksNumber);
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    /// @notice Set to true if a validator set change is in progress, and to false once it is finished.
    /// @param isInProgress Boolean flag indicating whether the validator set change is currently in progress.
    function setValidatorChange(bool isInProgress) external onlyOwner {
        validatorChange = isInProgress;
    }   

    modifier onlyFundAdmin() {
        if (msg.sender != fundAdmin) revert NotFundAdmin();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }
}
