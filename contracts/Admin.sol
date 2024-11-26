// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract Admin is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    Claims private claims;
    ClaimsHelper private claimsHelper;
    Validators private validators;
    SignedBatches private signedBatches;
    Slots private slots;

    address public fundAdmin;

    uint64 public constant MIN_NUMBER_OF_TRANSACTIONS = 2; //TODO SET THIS VALUE TO AGREED ON
    uint256 public constant MIN_CLAIM_BLOCK_AGE = 200; //TODO SET THIS VALUE TO AGREED ON
    uint256 public constant MIN_NUMBER_OF_SIGNED_BATCHES = 2; //TODO SET THIS VALUE TO AGREED ON

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

    function setDependencies(
        address _claimsAddress,
        address _claimsHelperAddress,
        address _validatorsAddress,
        address _signedBatchesAddress,
        address _sloptsAddress
    ) external onlyOwner {
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        slots = Slots(_sloptsAddress);
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

    function pruneConfirmedSignedBatches(uint8 _chainId, uint64 _deleteToBatchId) external onlyOwner {
        if (_deleteToBatchId <= claimsHelper.nextUnprunedConfirmedSignedBatchId(_chainId)) revert AlreadyPruned();

        if (MIN_NUMBER_OF_SIGNED_BATCHES + _deleteToBatchId > claimsHelper.lastConfirmedSignedBatchId(_chainId))
            revert ConfirmedTransactionsProtectedFromPruning();

        claimsHelper.pruneConfirmedSignedBatches(_chainId, _deleteToBatchId);
    }

    function pruneSignedBatches(uint256 _deleteToBlock) external onlyOwner {
        if (MIN_CLAIM_BLOCK_AGE + _deleteToBlock > block.number) revert TTLTooLow();

        signedBatches.pruneSignedBatches(
            validators.getQuorumNumberOfValidators(),
            validators.getValidatorsAddresses(),
            _deleteToBlock
        );
    }

    function pruneSlots(uint256 _deleteToBlock) external onlyOwner {
        if (MIN_CLAIM_BLOCK_AGE + _deleteToBlock > block.number) revert TTLTooLow();
        slots.pruneSlots(validators.getValidatorsAddresses(), _deleteToBlock);
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
