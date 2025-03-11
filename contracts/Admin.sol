// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";

contract Admin is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    Claims private claims;

    address public fundAdmin;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin) public initializer {
        _transferOwnership(_owner);
        upgradeAdmin = _upgradeAdmin;
        fundAdmin = _owner;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(address _claimsAddress) external onlyOwner {
        claims = Claims(_claimsAddress);
    }

    function updateChainTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainTokenQuantity
    ) external onlyFundAdmin {
        claims.updateChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity);
        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity);
    }

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

    function setFundAdmin(address _fundAdmin) external onlyOwner {
        if (_fundAdmin == address(0)) revert ZeroAddress();
        fundAdmin = _fundAdmin;
        emit FundAdminChanged(_fundAdmin);
    }

    function updateMaxNumberOfTransactions(uint16 _maxNumberOfTransactions) external onlyOwner {
        claims.updateMaxNumberOfTransactions(_maxNumberOfTransactions);
        emit UpdatedMaxNumberOfTransactions(_maxNumberOfTransactions);
    }

    function updateTimeoutBlocksNumber(uint8 _timeoutBlocksNumber) external onlyOwner {
        claims.updateTimeoutBlocksNumber(_timeoutBlocksNumber);
        emit UpdatedTimeoutBlocksNumber(_timeoutBlocksNumber);
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
