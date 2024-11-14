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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _claimsAddres) external onlyOwner {
        claims = Claims(_claimsAddres);
    }

    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _quantity) external onlyOwner {
        uint256 currentChainTokenQuantity = claims.chainTokenQuantity(_chainId);

        if (!claims.isChainRegistered(_chainId)) revert ChainIsNotRegistered(_chainId);
        if (_isIncrease) {
            claims.setChainTokenQuantity(_chainId, currentChainTokenQuantity + _quantity);
            emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
        } else if (claims.chainTokenQuantity(_chainId) < _quantity) {
            revert NegativeChainTokenAmount(currentChainTokenQuantity, _quantity);
        } else {
            claims.setChainTokenQuantity(_chainId, currentChainTokenQuantity - _quantity);
            emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
        }
    }
}
