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
    ///         on the destination chain for both native and wrapped tokens.
    /// @dev Emits a `NotEnoughFunds` event instead of reverting when balances are insufficient.
    /// @param _claim The BridgingRequestClaim struct containing claim details such as amounts and chain IDs.
    /// @param _index The index of the claim in the batch, used for event emission.
    /// @return bool Returns true if all required balances are sufficient, otherwise false.
    function validateBRC(BridgingRequestClaim calldata _claim, uint256 _index) external returns (bool) {
        (bool _isOk, bool _isCurrency, uint256 _totalAmount, ) = _validateBalanceCheck(
            _claim.destinationChainId,
            _claim.nativeCurrencyAmountDestination,
            _claim.wrappedTokenAmountDestination
        );
        if (_isOk) {
            return true;
        }

        return _handleInsufficientFundsEmit("BRC", _isCurrency, _totalAmount, _index);
    }

    /// @notice Validates a Refund Request Claim (RRC) by checking if sufficient balances exist
    ///         on the origin chain for both native and wrapped tokens.
    /// @dev Emits a `NotEnoughFunds` event instead of reverting when balances are insufficient.
    ///      Used to verify refund operations before processing them.
    /// @param _claim The RefundRequestClaim struct containing refund details such as chain ID, token amounts, and coin ID.
    /// @param _index The index of the claim in the batch, used for event emission.
    /// @return bool Returns true if all required balances are sufficient, otherwise false.
    function validateRRC(RefundRequestClaim calldata _claim, uint256 _index) external returns (bool) {
        (bool _isOk, bool _isCurrency, uint256 _totalAmount, ) = _validateBalanceCheck(
            _claim.originChainId,
            _claim.originAmount,
            _claim.originWrappedAmount
        );
        if (_isOk) {
            return true;
        }

        return _handleInsufficientFundsEmit("RRC", _isCurrency, _totalAmount, _index);
    }

    /// @notice Validates a defund request by ensuring sufficient token, wrapped token balances
    ///         exist on the specified chain before processing the defund.
    /// @dev Reverts if balances are insufficient, unlike other validation functions which emit events.
    ///      This function ensures that defund operations do not proceed if there are not enough funds
    ///      available on the given chain for the requested withdrawal.
    /// @param _chainId The ID of the chain from which funds are being defunded.
    /// @param _amount The amount of native tokens t_isOkd.
    /// @param _amountWrapped The amount of wrapped tokens to defund.
    function validateDefund(uint8 _chainId, uint256 _amount, uint256 _amountWrapped) external view {
        // For Defund, we revert instead of returning false
        (bool _isOk, bool _isCurrency, uint256 _totalAmount, uint256 _desiredAmount) = _validateBalanceCheck(
            _chainId,
            _amount,
            _amountWrapped
        );
        if (_isOk) {
            return;
        }

        return _handleInsufficientFundsRevert("Defund", _isCurrency, _chainId, _totalAmount, _desiredAmount);
    }

    /// @notice Updates token balances after processing a Bridging Request Claim (BRC).
    /// @dev
    /// - Decreases balances on the destination chain to reflect tokens or wrapped tokens being sent out.
    /// - Increases balances on the source chain **only if** this is the first occurrence of the claim
    ///   (i.e., not a retry).
    /// - Retries do not increase source balances again to avoid double-counting.
    /// @param _claim The Bridging Request Claim.
    function updateTokensBRC(BridgingRequestClaim calldata _claim) external onlyClaimsProcessor {
        // decrease destination
        _decChainBalances(
            _claim.destinationChainId,
            _claim.nativeCurrencyAmountDestination,
            _claim.wrappedTokenAmountDestination
        );

        // if it is the first occurance of Bridging Request Claim, add the amount to the source chain
        // otherwise, it is a retry and we do not add the amount to the source chain, since it has already been done
        // increase source (only once)
        if (_claim.retryCounter == 0) {
            _incChainBalances(_claim.sourceChainId, _claim.nativeCurrencyAmountSource, _claim.wrappedTokenAmountSource);
        }
    }

    /// @notice Updates chain token balances after a Bridging Execution Failed Claim (BEFC).
    /// @dev Increases both native and wrapped token balances on the specified chain.
    /// @param chainId The ID of the chain whose balances are being updated.
    /// @param totalAmount The amount of native tokens to add to the chain balance.
    /// @param totalWrappedAmount The amount of wrapped tokens to add to the chain balance.
    function updateTokensBEFC(
        uint8 chainId,
        uint256 totalAmount,
        uint256 totalWrappedAmount
    ) external onlyClaimsProcessor {
        _incChainBalances(chainId, totalAmount, totalWrappedAmount);
    }

    /// @notice Updates chain token balances after processing a Refund Request Claim (RRC).
    /// @dev Decreases the origin chain’s balances to reflect tokens or wrapped tokens
    ///      being returned as part of a refund operation.
    /// @param _claim The Refund Request Claim.
    function updateTokensRRC(RefundRequestClaim calldata _claim) external onlyClaimsProcessor {
        _decChainBalances(_claim.originChainId, _claim.originAmount, _claim.originWrappedAmount);
    }

    /// @notice Updates chain token balances after processing a Hot Wallet Increment Claim (HWIC).
    /// @dev Increases chain balances to reflect funds being added to the hot wallet.
    /// @param _claim The Hot Wallet Increment Claim.
    function updateTokensHWIC(HotWalletIncrementClaim calldata _claim) external onlyClaimsProcessor {
        _incChainBalances(_claim.chainId, _claim.amount, _claim.amountWrapped);
    }

    /// @notice Updates chain balances after a Defund operation.
    /// @dev Decreases the specified chain’s token and wrapped token balances to reflect
    ///      a successful defund transaction.
    /// @param _chainId The ID of the chain from which tokens are being defunded.
    /// @param _amount The amount of native tokens to subtract from the chain balance.
    /// @param _amountWrapped The amount of wrapped tokens to subtract from the chain balance.
    function updateDefund(uint8 _chainId, uint256 _amount, uint256 _amountWrapped) external onlyClaims {
        _decChainBalances(_chainId, _amount, _amountWrapped);
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
        if (_isIncrease) {
            _incSingle(chainTokenQuantity, _chainId, _chainTokenAmount);
        } else {
            _decSingle(chainTokenQuantity, _chainId, _chainTokenAmount);
        }
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
        if (_isIncrease) {
            _incSingle(chainWrappedTokenQuantity, _chainId, _chainWrappedTokenAmount);
        } else {
            _decSingle(chainWrappedTokenQuantity, _chainId, _chainWrappedTokenAmount);
        }
    }

    function _validateBalanceCheck(
        uint8 _chainId,
        uint256 _tokenAmount,
        uint256 _wrappedAmount
    ) internal view returns (bool, bool, uint256, uint256) {
        // Check native currency balance
        uint256 _currentToken = chainTokenQuantity[_chainId];
        if (_currentToken < _tokenAmount) {
            return (false, true, _currentToken, _tokenAmount);
        }

        // Check wrapped token balance
        uint256 _currentWrapped = chainWrappedTokenQuantity[_chainId];
        if (_currentWrapped < _wrappedAmount) {
            return (false, false, _currentWrapped, _wrappedAmount);
        }

        return (true, true, 0, 0);
    }

    /**
     * @dev Handles insufficient funds either by reverting or emitting an event.
     */
    function _handleInsufficientFundsEmit(
        string memory _prefix,
        bool _isCurrency,
        uint256 _currentAmount,
        uint256 _index
    ) internal returns (bool) {
        emit NotEnoughFunds(
            string.concat(_prefix, " - ", _isCurrency ? "Currency" : "Native Token"),
            _index,
            _currentAmount
        );
        return false;
    }

    function _handleInsufficientFundsRevert(
        string memory _prefix,
        bool _isCurrency,
        uint8 _chainId,
        uint256 _currentAmount,
        uint256 _requestedAmount
    ) internal pure {
        revert DefundRequestTooHigh(
            string.concat(_prefix, " - ", _isCurrency ? "Currency" : "Native Token"),
            _chainId,
            _currentAmount,
            _requestedAmount
        );
    }

    /// @dev Universal internal balances increase: handles tokens and wrapped tokens.
    function _incChainBalances(uint8 _chainId, uint256 _amount, uint256 _wrapped) internal {
        _incSingle(chainTokenQuantity, _chainId, _amount);
        _incSingle(chainWrappedTokenQuantity, _chainId, _wrapped);
    }

    /// @dev Universal internal balances decrease: handles tokens and wrapped tokens.
    function _decChainBalances(uint8 _chainId, uint256 _amount, uint256 _wrapped) internal {
        _decSingle(chainTokenQuantity, _chainId, _amount);
        _decSingle(chainWrappedTokenQuantity, _chainId, _wrapped);
    }

    /// @dev Safe internal increase for a mapping
    function _incSingle(mapping(uint8 => uint256) storage store, uint8 key, uint256 amount) internal {
        store[key] += amount;
    }

    /// @dev Safe internal decrease for a mapping
    function _decSingle(mapping(uint8 => uint256) storage store, uint8 key, uint256 amount) internal {
        store[key] -= amount;
    }

    /// TEMP FUNCTION TO MIGRATE CHAIN QUANTITIES TO 1e18 BASE
    function migrateChainTokenQuantitiesTo1e18(Chain[] calldata _chains) external onlyAdminContract {
        uint8 chainLength = uint8(_chains.length);

        for (uint8 i = 0; i < chainLength; i++) {
            uint8 _chainId = _chains[i].id;
            uint256 _quantity = chainTokenQuantity[_chainId];
            uint256 _quantityWrapped = chainWrappedTokenQuantity[_chainId];
            if (_quantity > 0) {
                chainTokenQuantity[_chainId] = _quantity * 1e12;
            }
            if (_quantityWrapped > 0) {
                chainWrappedTokenQuantity[_chainId] = _quantityWrapped * 1e12;
            }
        }
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.1";
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
