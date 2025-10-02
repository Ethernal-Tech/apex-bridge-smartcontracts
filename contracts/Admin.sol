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
    BridgingAddresses public bridgingAddresses;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[49] private __gap;

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

    /// @notice Sets the external BridgingAddresses contract dependency.
    /// @dev This function can only be called by the upgrade admin. It verifies that the provided address is a contract.
    /// @param _bridgingAddresses The address of the deployed BridgingAddresses contract.
    function setBridgingAddrsDependency(address _bridgingAddresses) external onlyUpgradeAdmin {
        if (!_isContract(_bridgingAddresses)) revert NotContractAddress();
        bridgingAddresses = BridgingAddresses(_bridgingAddresses);
    }

    /// @notice Updates token quantity for a specific chain
    /// @param _chainId ID of the chain to update
    /// @param _isIncrease Whether to increase (true) or decrease (false) the quantity
    /// @param _chainTokenQuantity Amount of tokens to add or subtract
    function updateChainTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainTokenQuantity
    ) external onlyFundAdmin {
        claims.updateChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity);
        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity);
    }

    /// @notice Updates wrapped token quantity for a specific chain
    /// @param _chainId ID of the chain to update
    /// @param _isIncrease Whether to increase (true) or decrease (false) the quantity
    /// @param _chainWrappedTokenQuantity Amount of tokens to add or subtract
    function updateChainWrappedTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainWrappedTokenQuantity
    ) external onlyFundAdmin {
        claims.updateChainWrappedTokenQuantity(_chainId, _isIncrease, _chainWrappedTokenQuantity);
        emit UpdatedChainWrappedTokenQuantity(_chainId, _isIncrease, _chainWrappedTokenQuantity);
    }

    /// @notice Updates coloredCoin quantity for a specific chain
    /// @param _chainId ID of the chain to update
    /// @param _isIncrease Whether to increase (true) or decrease (false) the quantity
    /// @param _chainColoredCointQuantity Amount of tokens to add or subtract
    /// @param _coloredCoinId ID of the colored coin to update
    function updateChainColoredCoinQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainColoredCointQuantity,
        uint8 _coloredCoinId
    ) external onlyFundAdmin {
        claims.updateChainColoredCoinQuantity(_chainId, _isIncrease, _chainColoredCointQuantity, _coloredCoinId);
        emit UpdatedChainColoredCoinQuantity(_chainId, _isIncrease, _chainColoredCointQuantity, _coloredCoinId);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    function getChainWrappedTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainWrappedTokenQuantity(_chainId);
    }

    function defund(
        uint8 _chainId,
        uint256 _amount,
        uint256 _amountWrapped,
        uint8 _coloredCoinId,
        string calldata _defundAddress
    ) external onlyFundAdmin {
        claims.defund(_chainId, _amount, _amountWrapped, _coloredCoinId, _defundAddress);
        emit ChainDefunded(_chainId, _amount, _amountWrapped, _coloredCoinId, _defundAddress);
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

    /// @notice Updates the number of bridge addresses for a specific chain.
    /// @dev Only callable by the contract owner. Reverts if the chain ID is not registered.
    /// @param _chainId The ID of the chain whose bridging address count is being updated.
    /// @param bridgingAddrsCount The new number of bridging addresses for the specified chain.
    function updateBridgingAddrsCount(uint8 _chainId, uint8 bridgingAddrsCount) external onlyOwner {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }

        bridgingAddresses.updateBridgingAddrsCount(_chainId, bridgingAddrsCount);
    }

    /// @notice Queues a redistribution transaction for the bridging addresses on a given chain.
    /// @dev Only callable by owner. Reverts if the specified chain is not registered.
    /// @param chainId The ID of the chain where token redistribution should occur.
    function redistributeBridgingAddrsTokens(uint8 chainId) external onlyOwner {
        if (!claims.isChainRegistered(chainId)) {
            revert ChainIsNotRegistered(chainId);
        }

        claims.createRedistributeTokensTx(chainId);
    }

    /// @notice Queues a transaction that does the dedicated operation for a bridging stake address.
    /// @dev Only callable by owner. Reverts if chain is not registered or transactionSubType is invalid.
    /// @param chainId The ID of the destination chain.
    /// @param bridgeAddrIndex The index of the bridging address to be delegated.
    /// @param stakePoolId The identifier of the stake pool to delegate to.
    /// @param transactionSubType The type of stake transaction to be executed.
    function stakeAddressOperation(
        uint8 chainId,
        uint8 bridgeAddrIndex,
        string calldata stakePoolId,
        uint8 transactionSubType
    ) external onlyOwner {
        if (!claims.isChainRegistered(chainId)) {
            revert ChainIsNotRegistered(chainId);
        }

        if (transactionSubType > TransactionTypesLib.STAKE_DEREGISTRATION) {
            revert InvalidStakeTransactionSubType(transactionSubType);
        }

        bridgingAddresses.stakeAddressOperation(chainId, bridgeAddrIndex, stakePoolId, transactionSubType);
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.2.0";
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
