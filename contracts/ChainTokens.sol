// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

contract ChainTokens is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;
    address private claimsAddress;
    address private adminContractAddress;

    /// @notice Mapping from chain ID to token quantity.
    /// @dev BlockchainId -> TokenQuantity
    mapping(uint8 => uint256) public chainTokenQuantity;

    /// @notice Mapping from chain ID to wrapped token quantity.
    /// @dev BlockchainId -> TokenQuantity
    mapping(uint8 => uint256) public chainWrappedTokenQuantity;

    /// @notice Registered colored coins
    /// @dev ColoredCoinId -> ChainId (!=0 if registered)
    mapping(uint8 => uint8) public coloredCoinToChain;

    /// @notice Mapping from chain ID to colored coin quantity.
    /// @dev BlockchainId -> ColoredCoinId -> ColoredCoinQuantity
    mapping(uint8 => mapping(uint8 => uint256)) public chainColoredCoinQuantity;

    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters.
    /// @param _owner Address to be set as contract owner.
    /// @param _upgradeAdmin Address allowed to upgrade the contract.
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _bridgeAddress Address of the Bridge contract.
    /// @param _adminContractAddress Address of the Admin contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsAddress,
        address _adminContractAddress
    ) external onlyOwner {
        if (!_isContract(_bridgeAddress) || !_isContract(_claimsAddress) || !_isContract(_adminContractAddress))
            revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claimsAddress = _claimsAddress;
        adminContractAddress = _adminContractAddress;
    }

    function validateBRC(BridgingRequestClaim calldata _claim, uint256 i) external onlyClaims returns (bool) {
        return
            _validateBalanceCheck(
                _claim.destinationChainId,
                _claim.coloredCoinId,
                _claim.nativeCurrencyAmountDestination,
                _claim.wrappedTokenAmountDestination,
                "BRC",
                i,
                false // use emit (no revert)
            );
    }

    function validateRRC(RefundRequestClaim calldata _claim, uint8 originChainId) external onlyClaims returns (bool) {
        return
            _validateBalanceCheck(
                originChainId,
                _claim.coloredCoinId,
                _claim.originAmount,
                _claim.originWrappedAmount,
                "RRC",
                0,
                false // use emit (no revert)
            );
    }

    function validateDefund(
        uint8 _chainId,
        uint256 _amount,
        uint256 _amountWrapped,
        uint8 _coloredCoinId
    ) external onlyClaims {
        if (_coloredCoinId != 0 && coloredCoinToChain[_coloredCoinId] != _chainId) {
            revert ColoredCoinNotNotRegisteredOnChain(_coloredCoinId, _chainId);
        }

        // For Defund, we revert instead of returning false
        _validateBalanceCheck(
            _chainId,
            _coloredCoinId,
            _amount,
            _amountWrapped,
            "Defund",
            0,
            true // use revert
        );
    }

    function updateTokensBRC(BridgingRequestClaim calldata _claim) external onlyClaims {
        // decrease destination
        _updateChainBalances(
            _claim.destinationChainId,
            _claim.coloredCoinId,
            _claim.nativeCurrencyAmountDestination,
            _claim.wrappedTokenAmountDestination,
            false
        );

        // if it is the first occurance of Bridging Request Claim, add the amount to the source chain
        // otherwise, it is a retry and we do not add the amount to the source chain, since it has already been done
        // increase source (only once)
        if (_claim.retryCounter == 0) {
            _updateChainBalances(
                _claim.sourceChainId,
                _claim.coloredCoinId,
                _claim.nativeCurrencyAmountSource,
                _claim.wrappedTokenAmountSource,
                true
            );
        }
    }

    function updateTokensBEFC(
        uint8 chainId,
        uint8 coloredCoinId,
        uint256 totalAmount,
        uint256 totalWrappedAmount
    ) external onlyClaims {
        _updateChainBalances(chainId, coloredCoinId, totalAmount, totalWrappedAmount, true);
    }

    function updateTokensRRC(RefundRequestClaim calldata _claim, uint8 originChainId) external onlyClaims {
        _updateChainBalances(
            originChainId,
            _claim.coloredCoinId,
            _claim.originAmount,
            _claim.originWrappedAmount,
            false
        );
    }

    function updateTokensHWIC(HotWalletIncrementClaim calldata _claim) external onlyClaims {
        _updateChainBalances(_claim.chainId, _claim.coloredCoinId, _claim.amount, _claim.amountWrapped, true);
    }

    function updateDefund(
        uint8 _chainId,
        uint256 _amount,
        uint256 _amountWrapped,
        uint8 _coloredCoinId
    ) external onlyClaims {
        _updateChainBalances(_chainId, _coloredCoinId, _amount, _amountWrapped, false);
    }

    // onlyClaims
    function setChainRegistered(
        uint8 _chainId,
        uint256 _initialTokenSupply,
        uint256 _initialWrappedTokenSupply
    ) external onlyClaims {
        chainTokenQuantity[_chainId] = _initialTokenSupply;
        chainWrappedTokenQuantity[_chainId] = _initialWrappedTokenSupply;
    }

    /// @notice Updates the token quantity for a registered chain by increasing or decreasing the amount.
    /// @dev Reverts if the chain is not registered or if subtraction causes underflow.
    /// @param _chainId The ID of the chain whose token quantity is to be updated.
    /// @param _isIncrease A boolean indicating whether to increase (true) or decrease (false) the token amount.
    /// @param _chainTokenAmount The amount of tokens to add or subtract from the chain's total.
    function updateChainTokenQuantity(uint8 _chainId, bool _isIncrease, uint256 _chainTokenAmount) external onlyClaims {
        _updateSingle(chainTokenQuantity, _chainId, _chainTokenAmount, _isIncrease);
    }

    /// @notice Updates the wrapped token quantity for a registered chain by increasing or decreasing the amount.
    /// @dev Reverts if the chain is not registered or if subtraction causes underflow.
    /// @param _chainId The ID of the chain whose token quantity is to be updated.
    /// @param _isIncrease A boolean indicating whether to increase (true) or decrease (false) the token amount.
    /// @param _chainWrappedTokenAmount The amount of tokens to add or subtract from the chain's total.
    function updateChainWrappedTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainWrappedTokenAmount
    ) external onlyClaims {
        _updateSingle(chainWrappedTokenQuantity, _chainId, _chainWrappedTokenAmount, _isIncrease);
    }

    /// @notice Updates the coloredCoin quantity for a registered chain by increasing or decreasing the amount.
    /// @dev Reverts if the chain is not registered or if subtraction causes underflow.
    /// @param _chainId The ID of the chain whose token quantity is to be updated.
    /// @param _isIncrease A boolean indicating whether to increase (true) or decrease (false) the token amount.
    /// @param _chainColoredCoinAmount The amount of tokens to add or subtract from the chain's total.
    /// @param _coloredCoinId The ID of the colored coin to update.
    function updateChainColoredCoinQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainColoredCoinAmount,
        uint8 _coloredCoinId
    ) external onlyAdminContract {
        if (_coloredCoinId != 0 && coloredCoinToChain[_coloredCoinId] != _chainId) {
            revert ColoredCoinNotNotRegisteredOnChain(_coloredCoinId, _chainId);
        }

        _updateSingle(chainColoredCoinQuantity[_chainId], _coloredCoinId, _chainColoredCoinAmount, _isIncrease);
    }

    function registerColoredCoin(ColoredCoin calldata _coloredCoin) external onlyBridge {
        coloredCoinToChain[_coloredCoin.coloredCoinId] = _coloredCoin.chainId;
    }

    function _validateBalanceCheck(
        uint8 _chainId,
        uint8 _coloredCoinId,
        uint256 _tokenAmount,
        uint256 _wrappedAmount,
        string memory _prefix,
        uint256 _index,
        bool _shouldRevert
    ) internal returns (bool) {
        uint256 _currentToken = chainTokenQuantity[_chainId];
        uint256 _currentWrapped = chainWrappedTokenQuantity[_chainId];

        if (_coloredCoinId != 0) {
            if (coloredCoinToChain[_coloredCoinId] == _chainId) {
                uint256 _currentColored = chainColoredCoinQuantity[_chainId][_coloredCoinId];
                if (_currentColored < _tokenAmount) {
                    return
                        _handleInsufficientFunds(
                            _shouldRevert,
                            _prefix,
                            "Colored Coin",
                            _chainId,
                            _currentColored,
                            _tokenAmount,
                            _index
                        );
                }
            }
        }
        // Check native currency balance
        else if (_currentToken < _tokenAmount) {
            return
                _handleInsufficientFunds(
                    _shouldRevert,
                    _prefix,
                    "Currency",
                    _chainId,
                    _currentToken,
                    _tokenAmount,
                    _index
                );
        }

        // Check wrapped token balance
        if (_currentWrapped < _wrappedAmount) {
            return
                _handleInsufficientFunds(
                    _shouldRevert,
                    _prefix,
                    "Native Token",
                    _chainId,
                    _currentWrapped,
                    _wrappedAmount,
                    _index
                );
        }

        return true;
    }

    /**
     * @dev Handles insufficient funds either by reverting or emitting an event.
     */
    function _handleInsufficientFunds(
        bool _shouldRevert,
        string memory _prefix,
        string memory _assetType,
        uint8 _chainId,
        uint256 _currentAmount,
        uint256 _requestedAmount,
        uint256 _index
    ) internal returns (bool) {
        if (_shouldRevert) {
            revert DefundRequestTooHigh(
                string.concat(_prefix, " - ", _assetType),
                _chainId,
                _currentAmount,
                _requestedAmount
            );
        } else {
            emit NotEnoughFunds(string.concat(_prefix, " - ", _assetType), _index, _currentAmount);
            return false;
        }
    }

    /// @dev Universal internal updater: handles tokens, wrapped tokens, and colored coins.
    function _updateChainBalances(
        uint8 _chainId,
        uint8 _coloredCoinId,
        uint256 _amount,
        uint256 _wrapped,
        bool _increase
    ) internal {
        if (_coloredCoinId == 0) {
            _updateSingle(chainTokenQuantity, _chainId, _amount, _increase);
        } else if (coloredCoinToChain[_coloredCoinId] == _chainId) {
            _updateSingle(chainColoredCoinQuantity[_chainId], _coloredCoinId, _amount, _increase);
        }

        _updateSingle(chainWrappedTokenQuantity, _chainId, _wrapped, _increase);
    }

    /// @dev Safe internal update for a mapping
    function _updateSingle(mapping(uint8 => uint256) storage store, uint8 key, uint256 amount, bool increase) internal {
        if (amount == 0) return;
        uint256 current = store[key];

        if (increase) store[key] += amount;
        else {
            if (current < amount) revert NegativeChainTokenAmount(current, amount);
            store[key] -= amount;
        }
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsAddress) revert NotClaims();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }

    modifier onlyAdminContract() {
        if (msg.sender != adminContractAddress) revert NotAdminContract();
        _;
    }
}
