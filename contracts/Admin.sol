// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract Admin is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    Claims private claims;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    // Minimal number of confirmed transaction to be kept at all times
    uint64 public constant MIN_NUMBER_OF_TRANSACTIONS = 2; //TODO SET THIS VALUE TO AGREED ON
    //Minimal claim block age to be pruned
    uint256 public constant MIN_CLAIM_BLOCK_AGE = 100; //TODO SET THIS VALUE TO AGREED ON

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _claimsAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _quantity) external onlyOwner {
        if (!claims.isChainRegistered(_chainId)) revert ChainIsNotRegistered(_chainId);
        if (claims.chainTokenQuantity(_chainId) < _quantity)
            revert NegativeChainTokenAmount(claims.chainTokenQuantity(_chainId), _quantity);

        claims.updateChainTokenQuantity(_chainId, _isIncrease, _quantity);

        emit UpdatedChainTokenQuantity(_chainId, _isIncrease, _quantity);
    }

    function getChainTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return claims.chainTokenQuantity(_chainId);
    }

    function pruneConfirmedTransactions(uint8 _chainId, uint64 _deleteToNonce) external onlyOwner {
        if (_deleteToNonce <= claims.nextUnprunedConfirmedTransaction(_chainId)) revert AlreadyPruned();

        if (MIN_NUMBER_OF_TRANSACTIONS + _deleteToNonce > claims.lastConfirmedTxNonce(_chainId))
            revert ConfirmedTransactionsProtectedFromPruning();

        claims.pruneConfirmedTransactions(_chainId, _chainId);
        //TODO add event everywhere
    }

    function pruneClaims(uint256 _deleteToBlock) external onlyOwner {
        if (MIN_CLAIM_BLOCK_AGE + _deleteToBlock > block.number) revert TTLTooLow();

        claimsHelper.pruneClaims(validators.getValidatorsAddresses(), _deleteToBlock);
    }
}
