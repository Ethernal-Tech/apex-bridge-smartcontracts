// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";

contract ChainTokens is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private adminContractAddress;
    address private bridgeAddress;
    address private claimsAddress;
    address private claimsProcessorAddress;
    address private registrationAddress;

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
    /// @param _claimsProcessorAddress Address of the Claims contract.
    /// @param _claimsProcessorAddress Address of the ClaimsProcessor contract.
    /// @param _adminContractAddress Address of the Admin contract.
    function setDependencies(
        address _adminContractAddress,
        address _bridgeAddress,
        address _claimsAddress,
        address _claimsProcessorAddress,
        address _registrationAddress
    ) external onlyOwner {
        if (
            !_isContract(_adminContractAddress) ||
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsAddress) ||
            !_isContract(_claimsProcessorAddress) ||
            !_isContract(_registrationAddress)
        ) revert NotContractAddress();
        adminContractAddress = _adminContractAddress;
        bridgeAddress = _bridgeAddress;
        claimsAddress = _claimsAddress;
        claimsProcessorAddress = _claimsProcessorAddress;
        registrationAddress = _registrationAddress;
    }

    /// @notice Validates a Bridging Request Claim (BRC) by ensuring sufficient balances exist
    ///         on the destination chain for both native and wrapped tokens (and colored coins if applicable).
    /// @dev Emits a `NotEnoughFunds` event instead of reverting when balances are insufficient.
    /// @param _claim The BridgingRequestClaim struct containing claim details such as amounts and chain IDs.
    /// @param _index The index of the claim in the batch, used for event emission.
    /// @return bool Returns true if all required balances are sufficient, otherwise false.
    function validateBRC(
        BridgingRequestClaim calldata _claim,
        uint256 _index
    ) external onlyClaimsProcessor returns (bool) {
        return
            _validateBalanceCheck(
                _claim.destinationChainId,
                _claim.coloredCoinId,
                _claim.nativeCurrencyAmountDestination,
                _claim.wrappedTokenAmountDestination,
                "BRC",
                _index,
                false // use emit (no revert)
            );
    }

    /// @notice Validates a Refund Request Claim (RRC) by checking if sufficient balances exist
    ///         on the origin chain for both native and wrapped tokens (and colored coins if applicable).
    /// @dev Emits a `NotEnoughFunds` event instead of reverting when balances are insufficient.
    ///      Used to verify refund operations before processing them.
    /// @param _claim The RefundRequestClaim struct containing refund details such as chain ID, token amounts, and coin ID.
    /// @param _index The index of the claim in the batch, used for event emission.
    /// @return bool Returns true if all required balances are sufficient, otherwise false.
    function validateRRC(
        RefundRequestClaim calldata _claim,
        uint256 _index
    ) external onlyClaimsProcessor returns (bool) {
        return
            _validateBalanceCheck(
                _claim.originChainId,
                _claim.coloredCoinId,
                _claim.originAmount,
                _claim.originWrappedAmount,
                "RRC",
                _index,
                false // use emit (no revert)
            );
    }

    /// @notice Validates a defund request by ensuring sufficient token, wrapped token, or colored coin balances
    ///         exist on the specified chain before processing the defund.
    /// @dev Reverts if balances are insufficient, unlike other validation functions which emit events.
    ///      This function ensures that defund operations do not proceed if there are not enough funds
    ///      available on the given chain for the requested withdrawal.
    /// @param _chainId The ID of the chain from which funds are being defunded.
    /// @param _amount The amount of native tokens (or colored coin equivalent) to defund.
    /// @param _amountWrapped The amount of wrapped tokens to defund.
    /// @param _coloredCoinId The ID of the colored coin involved in the defund, if applicable.
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

    /// @notice Updates token balances after processing a Bridging Request Claim (BRC).
    /// @dev
    /// - Decreases balances on the destination chain to reflect tokens or wrapped tokens being sent out.
    /// - Increases balances on the source chain **only if** this is the first occurrence of the claim
    ///   (i.e., not a retry).
    /// - Retries do not increase source balances again to avoid double-counting.
    /// @param _claim The Bridging Request Claim containing source/destination chain IDs,
    ///        colored coin ID, token amounts, and retry counter.
    function updateTokensBRC(BridgingRequestClaim calldata _claim) external onlyClaimsProcessor {
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

    /// @notice Updates chain token balances after a Bridging Execution Failed Claim (BEFC).
    /// @dev Increases both native and wrapped token balances on the specified chain.
    /// @param chainId The ID of the chain whose balances are being updated.
    /// @param coloredCoinId The ID of the colored coin involved in the operation.
    /// @param totalAmount The amount of native tokens to add to the chain balance.
    /// @param totalWrappedAmount The amount of wrapped tokens to add to the chain balance.
    function updateTokensBEFC(
        uint8 chainId,
        uint8 coloredCoinId,
        uint256 totalAmount,
        uint256 totalWrappedAmount
    ) external onlyClaimsProcessor {
        _updateChainBalances(chainId, coloredCoinId, totalAmount, totalWrappedAmount, true);
    }

    /// @notice Updates chain token balances after processing a Refund Request Claim (RRC).
    /// @dev Decreases the origin chain’s balances to reflect tokens or wrapped tokens
    ///      being returned as part of a refund operation.
    /// @param _claim The Refund Request Claim containing origin chain ID, colored coin ID,
    ///        and token/ wrapped token amounts.
    function updateTokensRRC(RefundRequestClaim calldata _claim) external onlyClaimsProcessor {
        _updateChainBalances(
            _claim.originChainId,
            _claim.coloredCoinId,
            _claim.originAmount,
            _claim.originWrappedAmount,
            false
        );
    }

    /// @notice Updates chain token balances after processing a Hot Wallet Increment Claim (HWIC).
    /// @dev Increases chain balances to reflect funds being added to the hot wallet.
    /// @param _claim The Hot Wallet Increment Claim containing chain ID, colored coin ID,
    ///        and token/ wrapped token amounts to add.
    function updateTokensHWIC(HotWalletIncrementClaim calldata _claim) external onlyClaimsProcessor {
        _updateChainBalances(_claim.chainId, _claim.coloredCoinId, _claim.amount, _claim.amountWrapped, true);
    }

    /// @notice Updates chain balances after a Defund operation.
    /// @dev Decreases the specified chain’s token and wrapped token balances to reflect
    ///      a successful defund transaction.
    /// @param _chainId The ID of the chain from which tokens are being defunded.
    /// @param _amount The amount of native tokens to subtract from the chain balance.
    /// @param _amountWrapped The amount of wrapped tokens to subtract from the chain balance.
    /// @param _coloredCoinId The ID of the colored coin involved in the defund, if applicable.
    function updateDefund(
        uint8 _chainId,
        uint256 _amount,
        uint256 _amountWrapped,
        uint8 _coloredCoinId
    ) external onlyClaims {
        _updateChainBalances(_chainId, _coloredCoinId, _amount, _amountWrapped, false);
    }

    /// @notice Sets the initial token and wrapped token quantities for a specific chain.
    /// @dev This function is typically called during the initial setup or synchronization process
    ///      to establish the starting state of token balances on a given chain.
    ///      Only the Claims contract is authorized to call this function.
    /// @param _chainId The ID of the chain whose initial balances are being set.
    /// @param _initialTokenSupply The initial amount of native tokens available on the chain.
    /// @param _initialWrappedTokenSupply The initial amount of wrapped tokens available on the chain.
    function setInitialTokenQuantities(
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
    function updateChainTokenQuantity(
        uint8 _chainId,
        bool _isIncrease,
        uint256 _chainTokenAmount
    ) external onlyAdminContract {
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
    ) external onlyAdminContract {
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

    /// @notice Registers a new colored coin and associates it with a specific chain.
    /// @dev Updates the mapping of colored coin IDs to their corresponding chain IDs.
    ///      This function can only be called by the Bridge contract.
    /// @param _coloredCoin The colored coin data structure containing the colored coin ID
    ///        and the chain ID it belongs to.
    function registerColoredCoin(ColoredCoin calldata _coloredCoin) external onlyRegistration {
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

        // Check native currency balance
        if (_coloredCoinId == 0 && _currentToken < _tokenAmount) {
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
            // Check colored coin balance
        } else if (coloredCoinToChain[_coloredCoinId] == _chainId) {
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
        if (increase) store[key] += amount;
        else {
            store[key] -= amount;
        }
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }

    modifier onlyAdminContract() {
        if (msg.sender != adminContractAddress) revert NotAdminContract();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsAddress) revert NotClaims();
        _;
    }

    modifier onlyClaimsProcessor() {
        if (msg.sender != claimsProcessorAddress) revert NotClaimsProcessor();
        _;
    }

    modifier onlyRegistration() {
        if (msg.sender != registrationAddress) revert NotRegistration();
        _;
    }
}
