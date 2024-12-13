// SPDX-License-Identifier: UNLICENSED
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
        uint256 _chainTokenQuantity,
        uint256 _chainWrappedTokenQuantity
    ) external onlyFundAdmin {
        if (!claims.isChainRegistered(_chainId)) revert ChainIsNotRegistered(_chainId);
        if (!_isIncrease && claims.chainTokenQuantity(_chainId) < _chainTokenQuantity)
            revert NegativeChainTokenAmount(claims.chainTokenQuantity(_chainId), _chainTokenQuantity);
        if (!_isIncrease && claims.chainWrappedTokenQuantity(_chainId) < _chainWrappedTokenQuantity)
            revert NegativeChainTokenAmount(claims.chainWrappedTokenQuantity(_chainId), _chainWrappedTokenQuantity);

        claims.updateChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity, _chainWrappedTokenQuantity);

        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _chainTokenQuantity, _chainWrappedTokenQuantity);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    function defund(uint8 _chainId, string calldata _defundAddress, uint256 _amount) external onlyFundAdmin {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }

        if (claims.getChainTokenQuantity(_chainId) < _amount) {
            revert DefundRequestTooHigh(_chainId, claims.getChainTokenQuantity(_chainId), _amount);
        }

        claims.defund(_chainId, _amount, _defundAddress);

        emit ChainDefunded(_chainId, _amount);
    }

    function setFundAdmin(address _fundAdmin) external onlyOwner {
        if (_fundAdmin == address(0)) revert ZeroAddress();
        fundAdmin = _fundAdmin;
        emit FundAdminChanged(_fundAdmin);
    }

    modifier onlyFundAdmin() {
        if (msg.sender != fundAdmin) revert NotFundAdmin();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
