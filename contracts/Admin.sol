// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Utils.sol";
import "./Claims.sol";

contract Admin is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    Claims private claims;

    address public fundAdmin;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
        fundAdmin = _owner;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(address _claimsAddress) external onlyOwner {
        if (!_isContract(_claimsAddress)) revert NotContractAddress();
        claims = Claims(_claimsAddress);
    }

    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _quantity) external onlyFundAdmin {
        claims.updateChainTokenQuantity(_chainId, _isIncrease, _quantity);
        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    function defund(uint8 _chainId, string calldata _defundAddress, uint256 _amount) external onlyFundAdmin {
        claims.defund(_chainId, _amount, _defundAddress);
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

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyBridge() {
        if (msg.sender != address(claims)) revert NotBridge();
        _;
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
