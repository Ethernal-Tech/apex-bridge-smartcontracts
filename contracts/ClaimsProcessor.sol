// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/BatchTypesLib.sol";
import "./interfaces/ConstantsLib.sol";
import "./interfaces/TransactionTypesLib.sol";
import "./BridgingAddresses.sol";
import "./ChainTokens.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

/// @title ClaimsProcessor
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract ClaimsProcessor is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private adminContractAddress;
    address private registrationAddress;
    BridgingAddresses private bridgingAddresses;
    ChainTokens private chainTokens;
    Claims private claims;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    /// @notice Maximum number of retries allowed for claims.
    uint8 private constant MAX_NUMBER_OF_RETRIES = 3;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
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
    /// @param _adminContractAddress is set first to avoid circular dependency issues.
    /// @param _bridgingAddresses Address of the BridgingAddresses contract.
    /// @param _chainTokensAddress Address of the ChainTokens contract.
    /// @param _claimsAddress Address of the Claims contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _registrationAddress Address of the Registration contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _adminContractAddress,
        address _bridgingAddresses,
        address _chainTokensAddress,
        address _claimsAddress,
        address _claimsHelperAddress,
        address _registrationAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_adminContractAddress) ||
            !_isContract(_bridgingAddresses) ||
            !_isContract(_chainTokensAddress) ||
            !_isContract(_claimsAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_registrationAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        adminContractAddress = _adminContractAddress;
        bridgingAddresses = BridgingAddresses(_bridgingAddresses);
        chainTokens = ChainTokens(_chainTokensAddress);
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        registrationAddress = _registrationAddress;
        validators = Validators(_validatorsAddress);
    }

    /// @notice Submits a Bridging Request Claim (BRC) for processing.
    /// @dev This function checks if there are enough funds available on the destination chain, validates the claim,
    ///      and updates the state of the contract by confirming the transaction and adjusting token quantities.
    /// @param _claim The bridging request claim containing the details of the transaction.
    /// @param i The index of the claim in the array of bridging request claims.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If there are not enough funds on the destination chain, the function emits a `NotEnoughFunds` event and exits early.
    /// @dev The function requires a quorum of validators to approve the claim before proceeding with the transaction.
    /// @dev After quorum is reached, the destination chain's token quantity is reduced, and the source chain's token quantity is increased if it's the first retry.
    /// @dev The function also updates the next timeout block if necessary and sets the confirmed transaction details.
    function submitClaimsBRC(BridgingRequestClaim calldata _claim, uint256 i, address _caller) external onlyClaims {
        if (!chainTokens.validateBRC(_claim, i)) {
            return;
        }

        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
                validators.getValidatorIndex(_caller) - 1,
                keccak256(abi.encode("BRC", _claim)),
                validators.getQuorumNumberOfValidators()
            )
        ) {
            chainTokens.updateTokensBRC(_claim);

            uint8 _destinationChainId = _claim.destinationChainId;

            uint256 _confirmedTxCount = claims.getBatchingTxsCount(_destinationChainId);

            claims.setConfirmedTransactions(_claim);

            _updateNextTimeoutBlockIfNeeded(_destinationChainId, _confirmedTxCount);
        }
    }

    /// @notice Submits a Batch Executed Claim (BEC) for processing.
    /// @dev This function checks if a batch has already been processed, validates the claim, and updates the state
    ///      by resetting the current batch block, updating the last transaction nonce, and managing timeout blocks.
    /// @param _claim The batch executed claim containing the details of the batch execution.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If the batch has already been processed (first and last transaction nonces are zero), the function exits early
    ///      to prevent double-processing of the same batch.
    /// @dev A quorum of validators is required to approve the claim before proceeding.
    /// @dev If the batch is not a consolidation, the batch’s last transaction nonce is updated, and the next timeout block
    ///      is set based on the current block number.
    /// @dev The claim's corresponding signed batch data is deleted once the claim is processed.
    function submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) external onlyClaims {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
                validators.getValidatorIndex(_caller) - 1,
                keccak256(abi.encode("BEC", _claim)),
                validators.getQuorumNumberOfValidators()
            )
        ) {
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);
            claimsHelper.setConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.EXECUTED);

            // do not process included transactions if it is a consolidation
            if (_confirmedSignedBatch.batchType == BatchTypesLib.CONSOLIDATION) {
                return;
            }

            claims.setLastBatchedTxNonce(chainId, _confirmedSignedBatch.lastTxNonceId);
            claims.setNextTimeoutBlock(chainId, block.number + claims.timeoutBlocksNumber());
        }
    }

    /// @notice Processes a Batch Execution Failed Claim (BEFC) submitted by a validator.
    /// @dev This function ensures that a failed batch is handled correctly, retries transactions if possible,
    /// and updates state to reflect the failure. It also prevents double processing by checking whether the batch
    /// has already been finalized.
    /// @param _claim The BatchExecutionFailedClaim submitted by a validator. Contains chain and batch identifiers.
    /// @param _caller The address of the validator who submitted the claim.
    function submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) external onlyClaims {
        uint8 chainId = _claim.chainId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            _claim.batchNonceId
        );

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
                validators.getValidatorIndex(_caller) - 1,
                keccak256(abi.encode("BEFC", _claim)),
                validators.getQuorumNumberOfValidators()
            )
        ) {
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);
            claimsHelper.setConfirmedSignedBatchStatus(chainId, _claim.batchNonceId, ConstantsLib.FAILED);

            // do not process included transactions if it is a consolidation
            if (_confirmedSignedBatch.batchType == BatchTypesLib.CONSOLIDATION) {
                return;
            }

            uint64 _firstTxNonce = _confirmedSignedBatch.firstTxNonceId;
            uint64 _lastTxNonce = _confirmedSignedBatch.lastTxNonceId;

            // Iterates through all transactions in the batch
            // correct the funds state and retries defund transaction
            // by creating new transactions
            // or in face maximal number of retries has been reached
            // emits an event and makes changes to the hot wallet balance
            for (uint64 i = _firstTxNonce; i <= _lastTxNonce; i++) {
                ConfirmedTransaction memory _ctx = claims.getConfirmedTransaction(chainId, i);
                uint8 _txType = _ctx.transactionType;

                if (_txType == TransactionTypesLib.NORMAL) {
                    chainTokens.updateTokensBEFC(
                        chainId,
                        _ctx.coloredCoinId,
                        _ctx.totalAmount,
                        _ctx.totalWrappedAmount
                    );
                } else if (_txType == TransactionTypesLib.DEFUND) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_RETRIES) {
                        claims.retryTx(chainId, _ctx);
                    } else {
                        chainTokens.updateTokensBEFC(
                            chainId,
                            _ctx.coloredCoinId,
                            _ctx.totalAmount,
                            _ctx.totalWrappedAmount
                        );

                        emit DefundFailedAfterMultipleRetries();
                    }
                } else if (_txType == TransactionTypesLib.STAKE) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_RETRIES) {
                        claims.retryTx(chainId, _ctx);
                    } else {
                        bridgingAddresses.updateBridgingAddressState(
                            chainId,
                            _ctx.bridgeAddrIndex,
                            _ctx.transactionSubType == TransactionTypesLib.STAKE_DEREGISTRATION
                        );
                        emit StakeOperationFailedAfterMultipleRetries(_ctx.transactionSubType);
                    }
                } else if (_txType == TransactionTypesLib.REDISTRIBUTION) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_RETRIES) {
                        claims.retryTx(chainId, _ctx);
                    } else {
                        emit TokensRedistributionFailedAfterMultipleRetries(chainId);
                    }
                }
            }

            claims.setLastBatchedTxNonce(chainId, _confirmedSignedBatch.lastTxNonceId);
            claims.setNextTimeoutBlock(chainId, block.number + claims.timeoutBlocksNumber());
        }
    }

    /// @notice Handles the submission and quorum verification of a RefundRequestClaim (RRC).
    /// @dev This function is called internally to process RRC claims. It ensures proper validation, quorum voting,
    ///      and, if applicable, performs hot wallet refund operations and transaction confirmation updates.
    ///      Quorum is tracked via a hashed claim and set through the `claimsHelper`.
    /// @param _claim The RefundRequestClaim struct containing all data relevant to the refund request.
    /// @param _caller The address of the validator submitting the claim.
    ///
    /// Requirements:
    /// - `refundTransactionHash` must be zero (temporary until automatic refunds are implemented).
    /// - If `shouldDecrementHotWallet` is true and `retryCounter` is 0, there must be sufficient funds
    ///   in both `chainTokenQuantity` and `chainWrappedTokenQuantity`.
    ///
    /// Emits:
    /// - `NotEnoughFunds` if the claim requires hot wallet decrement and there's not enough balance.
    ///
    /// Effects:
    /// - Sets the validator's vote via `claimsHelper`.
    /// - If quorum is reached, updates token balances, confirms the refund transaction, and adjusts timeout blocks.
    function submitClaimsRRC(RefundRequestClaim calldata _claim, uint256 _index, address _caller) external onlyClaims {
        // temporary check until automatic refund is implemented
        // once automatic refund is implemented, this check should be that
        // either originTransactionHash or refundTransactionHash should be empty
        if (_claim.refundTransactionHash != bytes32(0)) {
            revert InvalidData("refundTransactionHash");
        }

        // check token quantity on source if needed
        if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0 && !chainTokens.validateRRC(_claim, _index)) {
            // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
            return;
        }

        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
                validators.getValidatorIndex(_caller) - 1,
                keccak256(abi.encode("RRC", _claim)),
                validators.getQuorumNumberOfValidators()
            )
        ) {
            uint8 originChainId = _claim.originChainId;

            uint256 _confirmedTxCount = claims.getBatchingTxsCount(originChainId);

            if (_claim.shouldDecrementHotWallet && _claim.retryCounter == 0) {
                // refund after failing on destination chain, return funds to hot wallet
                chainTokens.updateTokensRRC(_claim);
            }

            claims.setConfirmedTransactionsRRC(_claim);

            _updateNextTimeoutBlockIfNeeded(originChainId, _confirmedTxCount);
        }
    }

    /// @notice Submits a Hot Wallet Increment Claim (HWIC) for processing.
    /// @dev This function processes a claim that increases the hot wallet balance of a specific chain.
    ///      It checks if the quorum of validators has been reached before applying the change to the hot wallet.
    /// @param _claim The hot wallet increment claim containing the chain ID and the amount to be added to the hot wallet.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev The claim is validated by ensuring that a quorum of validators has approved it before proceeding.
    /// @dev If the quorum is reached, the specified amount is added to the hot wallet balance for the given chain.
    function submitClaimHWIC(HotWalletIncrementClaim calldata _claim, address _caller) external onlyClaims {
        if (
            claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
                validators.getValidatorIndex(_caller) - 1,
                keccak256(abi.encode("HWIC", _claim)),
                validators.getQuorumNumberOfValidators()
            )
        ) {
            chainTokens.updateTokensHWIC(_claim);
        }
    }

    /// @notice Updates the next timeout block for a given chain if certain conditions are met.
    /// @dev This function resets the timeout block only when there is no batch in progress,
    ///      no confirmed transactions, and the current block has reached or passed the timeout.
    /// @param _chainId The ID of the chain to update the timeout block for.
    /// @param _confirmedTxCount The number of confirmed transactions for the specified chain.
    function _updateNextTimeoutBlockIfNeeded(uint8 _chainId, uint256 _confirmedTxCount) internal {
        if (
            (claimsHelper.currentBatchBlock(_chainId) == -1) && // there is no batch in progress
            (_confirmedTxCount == 0) && // check if there is no other confirmed transactions
            (block.number >= claims.nextTimeoutBlock(_chainId))
        ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
        {
            claims.setNextTimeoutBlock(_chainId, block.number + claims.timeoutBlocksNumber());
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

    modifier onlyClaims() {
        if (msg.sender != address(claims)) revert NotClaims();
        _;
    }
}
