// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Utils.sol";
import "./Claims.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/TransactionTypesLib.sol";

/// @title Admin Contract
/// @notice Manages configuration and privileged updates for the bridge system
/// @dev UUPS upgradable contract using OpenZeppelin upgradeable framework
contract Admin is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address public fundAdmin;
    Claims private claims;
    address private bridgeAddress;
    address private claimsAddress;

    /// @notice Tracks whether a specific bridging address has been delegated to a stake pool on a given chain.
    /// @dev Mapping: chainId => bridgeAddrIndex => true if delegated, false otherwise.
    mapping(uint8 => mapping(uint8 => bool)) public isAddrDelegatedToStake;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[47] private __gap;

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
    /// @param _bridgeAddress Address of the Bridge contract
    function setDependencies(address _claimsAddress, address _bridgeAddress) external onlyOwner {
        if (!_isContract(_claimsAddress) || !_isContract(_bridgeAddress)) revert NotContractAddress();
        claims = Claims(_claimsAddress);
        bridgeAddress = _bridgeAddress;
        claimsAddress = _claimsAddress;
    }

    /// @notice Records a stake delegation transaction for a specific bridging address on a given chain.
    /// @dev Reverts if the address is already delegated or the chain is not registered.
    /// @param chainId The ID of the chain where the delegation is made.
    /// @param bridgeAddrIndex The index of the bridging address being delegated.
    /// @param stakePoolId The identifier of the stake pool to delegate to. Should be at least 56 bytes long
    /// @param doRegistration Whether to register the stake address.
    function delegateAddrToStakePool(
        uint8 chainId,
        uint8 bridgeAddrIndex,
        string calldata stakePoolId,
        bool doRegistration
    ) external onlyBridge {
        // cardano stake pool id string can be: (Bech32, size=56–64, pool1...) or (Hex[raw ID], size=56)
        if (bytes(stakePoolId).length < 56) {
            revert InvalidData(stakePoolId);
        }

        if (isAddrDelegatedToStake[chainId][bridgeAddrIndex] && doRegistration) {
            revert AddrAlreadyDelegatedToStake(chainId, bridgeAddrIndex);
        }

        if (!claims.isChainRegistered(chainId)) {
            revert ChainIsNotRegistered(chainId);
        }

        isAddrDelegatedToStake[chainId][bridgeAddrIndex] = true;
        
        uint8 transactionType = doRegistration
            ? TransactionTypesLib.STAKE_REGISTRATION
            : TransactionTypesLib.STAKE_DELEGATION;
            
        claims.createStakeTransaction(
            chainId,
            bridgeAddrIndex,
            stakePoolId,
            transactionType
        );
    }

    /// @notice Deregisters a stake address for a specific bridging address on a given chain.
    /// @param chainId The ID of the chain where the deregistration is made.
    /// @param bridgeAddrIndex The index of the bridging address being deregistered.
    function deregisterStakeAddress(
        uint8 chainId,
        uint8 bridgeAddrIndex
    ) external onlyBridge {
        if (!isAddrDelegatedToStake[chainId][bridgeAddrIndex]) {
            revert AddrNotDelegatedToStake(chainId, bridgeAddrIndex);
        }

        if (!claims.isChainRegistered(chainId)) {
            revert ChainIsNotRegistered(chainId);
        }

        isAddrDelegatedToStake[chainId][bridgeAddrIndex] = false;
        claims.createStakeTransaction(
            chainId,
            bridgeAddrIndex,
            "", // Empty string for deregistration since stakePoolId is not used
            TransactionTypesLib.STAKE_DEREGISTRATION
        );
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
        string calldata _defundAddress
    ) external onlyFundAdmin {
        claims.defund(_chainId, _amount, _amountWrapped, _defundAddress);
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

    /// @notice this function is only for admin if stake pool registration goes wrong
    function clearIsAddrDelegatedToStake() external onlyUpgradeAdmin {
        // currently there are 4 chains and only one address
        for (uint8 _chainID = 1; _chainID < 5; _chainID++) {
            for (uint8 _indx = 0; _indx < 1; _indx++) {
                isAddrDelegatedToStake[_chainID][_indx] = false;
            }
        }
    }

    /// @notice Check if a bridging address is delegated to stake on a given chain.
    /// @param chainId The ID of the chain to check.
    /// @param bridgeAddrIndex The index of the bridging address to check.
    /// @return True if the address is delegated, false otherwise.
    function isAddressDelegatedToStake(uint8 chainId, uint8 bridgeAddrIndex) external view returns (bool) {
        return isAddrDelegatedToStake[chainId][bridgeAddrIndex];
    }

    /// @notice Set the delegation status for a bridging address on a given chain.
    /// @param chainId The ID of the chain.
    /// @param bridgeAddrIndex The index of the bridging address.
    /// @param isDelegated The delegation status to set.
    function setAddressDelegatedToStake(uint8 chainId, uint8 bridgeAddrIndex, bool isDelegated) external onlyClaims {
        isAddrDelegatedToStake[chainId][bridgeAddrIndex] = isDelegated;
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.1.0";
    }

    modifier onlyFundAdmin() {
        if (msg.sender != fundAdmin) revert NotFundAdmin();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsAddress) revert NotClaims();
        _;
    }
}
