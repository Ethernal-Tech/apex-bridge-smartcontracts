// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";

contract Admin is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    Claims private claims;

    address public fundAdmin;
    //chain -> address to defund to
    mapping(uint8 => string) public defundAddress;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        fundAdmin = _owner;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _claimsAddress) external onlyOwner {
        claims = Claims(_claimsAddress);
    }

    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _quantity) external onlyFundAdmin {
        if (!claims.isChainRegistered(_chainId)) revert ChainIsNotRegistered(_chainId);
        if (claims.chainTokenQuantity(_chainId) < _quantity)
            revert NegativeChainTokenAmount(claims.chainTokenQuantity(_chainId), _quantity);

        claims.updateChainTokenQuantity(_chainId, _isIncrease, _quantity);

        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    function defund(uint8 _chainId, uint256 _amount) external onlyFundAdmin {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }

        if (claims.getChainTokenQuantity(_chainId) < _amount) {
            revert DefundRequestTooHigh(_chainId, claims.getChainTokenQuantity(_chainId), _amount);
        }

        claims.defund(_chainId, _amount, defundAddress[_chainId]);

        emit ChainDefunded(_chainId, _amount);
    }

    function setFundAdmin(address _fundAdmin) external onlyOwner {
        if (_fundAdmin == address(0)) revert ZeroAddress();
        fundAdmin = _fundAdmin;
        emit FundAdminChanged(_fundAdmin);
    }

    function setDefundAddress(uint8 _chainId, string calldata _address) external onlyFundAdmin {
        defundAddress[_chainId] = _address;
        emit DefundAddressChanged(_chainId, _address);
    }

    modifier onlyFundAdmin() {
        if (msg.sender != fundAdmin) revert NotFundAdmin();
        _;
    }
}
