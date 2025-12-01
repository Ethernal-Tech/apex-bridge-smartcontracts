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
import "./Registration.sol";
import "./Validators.sol";

/// @title ClaimsProcessor
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract ClaimsProcessor is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice Maximum number of claims allowed per submission.
    uint8 private constant MAX_NUMBER_OF_CLAIMS = 32;
    /// @notice Maximum number of receivers in a BridgingRequestClaim.
    uint8 private constant MAX_NUMBER_OF_RECEIVERS = 16;

    address private bridgeAddress;
    address private upgradeAdmin;
    address private adminContractAddress;
    BridgingAddresses private bridgingAddresses;
    ChainTokens private chainTokens;
    Claims private claims;
    ClaimsHelper private claimsHelper;
    Registration private registration;
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
    /// @param _bridgeContractAddress Address of the Bridge contract
    /// @param _adminContractAddress is set first to avoid circular dependency issues.
    /// @param _bridgingAddresses Address of the BridgingAddresses contract.
    /// @param _chainTokensAddress Address of the ChainTokens contract.
    /// @param _claimsAddress Address of the Claims contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _registrationAddress Address of the Registration contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _bridgeContractAddress,
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
            !_isContract(_validatorsAddress) ||
            !_isContract(_bridgeContractAddress)
        ) revert NotContractAddress();
        bridgeAddress = _bridgeContractAddress;
        adminContractAddress = _adminContractAddress;
        bridgingAddresses = BridgingAddresses(_bridgingAddresses);
        chainTokens = ChainTokens(_chainTokensAddress);
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        registration = Registration(_registrationAddress);
        validators = Validators(_validatorsAddress);
    }

    /// @notice Submit claims from validators for reaching consensus.
    /// @param _claims Struct containing all types of validator claims.
    /// @param _caller Address of the validator submitting the claims.
    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        uint256 hotWalletIncrementClaimsLength = _claims.hotWalletIncrementClaims.length;

        uint256 claimsLength = bridgingRequestClaimsLength +
            batchExecutedClaimsLength +
            batchExecutionFailedClaimsLength +
            refundRequestClaimsLength +
            hotWalletIncrementClaimsLength;

        if (claimsLength > MAX_NUMBER_OF_CLAIMS) {
            revert TooManyClaims(claimsLength, MAX_NUMBER_OF_CLAIMS);
        }

        for (uint i; i < bridgingRequestClaimsLength; i++) {
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            uint8 sourceChainId = _claim.sourceChainId;
            uint8 destinationChainId = _claim.destinationChainId;

            if (!registration.isChainRegistered(sourceChainId)) {
                revert ChainIsNotRegistered(sourceChainId);
            }

            if (!registration.isChainRegistered(destinationChainId)) {
                revert ChainIsNotRegistered(destinationChainId);
            }

            if (_claim.receivers.length > MAX_NUMBER_OF_RECEIVERS) {
                revert TooManyReceivers(_claim.receivers.length, MAX_NUMBER_OF_RECEIVERS);
            }

            _submitClaimsBRC(_claim, i, _caller);
        }

        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!registration.isChainRegistered(_claim.chainId)) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEC(_claim, _caller);
        }

        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!registration.isChainRegistered(_claim.chainId)) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEFC(_claim, _caller);
        }

        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            uint8 originChainId = _claim.originChainId;
            if (!registration.isChainRegistered(originChainId)) {
                revert ChainIsNotRegistered(originChainId);
            }

            _submitClaimsRRC(_claim, i, _caller);
        }
        for (uint i; i < hotWalletIncrementClaimsLength; i++) {
            HotWalletIncrementClaim calldata _claim = _claims.hotWalletIncrementClaims[i];
            uint8 chainId = _claim.chainId;
            if (!registration.isChainRegistered(chainId)) {
                revert ChainIsNotRegistered(chainId);
            }

            _submitClaimHWIC(_claim, _caller);
        }
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
    function _submitClaimsBRC(BridgingRequestClaim calldata _claim, uint256 i, address _caller) internal {
        bytes32 _claimHash = keccak256(abi.encode("BRC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.numberOfVotes(_claimHash);
        // if quorum is reached, exit MUST occur before any validation!
        // @see AD-784 Reactor Bridge SC - Not enough funds event even when quorum is reached
        if (_votesCount == _quorumCount) {
            return;
        }

        if (!chainTokens.validateBRC(_claim, i)) {
            return;
        }

        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            chainTokens.updateTokensBRC(_claim);

            uint8 _destinationChainId = _claim.destinationChainId;
            uint256 _confirmedTxCount = claims.getBatchingTxsCount(_destinationChainId);

            claims.setConfirmedTransactions(_claim);
            claims.updateNextTimeoutBlockIfNeeded(_destinationChainId, _confirmedTxCount);
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
    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );

        bytes32 _claimHash = keccak256(abi.encode("BEC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.numberOfVotes(_claimHash);

        // if quorum is reached, exit MUST occur before any validation!
        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_votesCount == _quorumCount || _confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            // current batch block must be reset in any case because otherwise bridge will be blocked
            claimsHelper.resetCurrentBatchBlock(chainId);
            claimsHelper.setConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.EXECUTED);

            // do not process included transactions if it is a consolidation
            if (_confirmedSignedBatch.batchType == BatchTypesLib.CONSOLIDATION) {
                return;
            }

            claims.setLastBatchedTxNonce(chainId, _confirmedSignedBatch.lastTxNonceId);
            claims.setNextTimeoutBlock(chainId);
        }
    }

    /// @notice Processes a Batch Execution Failed Claim (BEFC) submitted by a validator.
    /// @dev This function ensures that a failed batch is handled correctly, retries transactions if possible,
    /// and updates state to reflect the failure. It also prevents double processing by checking whether the batch
    /// has already been finalized.
    /// @param _claim The BatchExecutionFailedClaim submitted by a validator. Contains chain and batch identifiers.
    /// @param _caller The address of the validator who submitted the claim.
    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            _claim.batchNonceId
        );

        bytes32 _claimHash = keccak256(abi.encode("BEFC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.numberOfVotes(_claimHash);

        // if quorum is reached, exit MUST occur before any validation!
        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_votesCount == _quorumCount || _confirmedSignedBatch.status != ConstantsLib.IN_PROGRESS) {
            return;
        }

        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
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
                    chainTokens.updateTokensBEFC(chainId, _ctx.totalAmount, _ctx.totalWrappedAmount);
                } else if (_txType == TransactionTypesLib.DEFUND) {
                    if (_ctx.retryCounter < MAX_NUMBER_OF_RETRIES) {
                        claims.retryTx(chainId, _ctx);
                    } else {
                        chainTokens.updateTokensBEFC(chainId, _ctx.totalAmount, _ctx.totalWrappedAmount);

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
            claims.setNextTimeoutBlock(chainId);
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
    function _submitClaimsRRC(RefundRequestClaim calldata _claim, uint256 _index, address _caller) internal {
        // temporary check until automatic refund is implemented
        // once automatic refund is implemented, this check should be that
        // either originTransactionHash or refundTransactionHash should be empty
        if (_claim.refundTransactionHash != bytes32(0)) {
            revert InvalidData("refundTransactionHash");
        }

        bytes32 _claimHash = keccak256(abi.encode("RRC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.numberOfVotes(_claimHash);
        // if quorum is reached, exit MUST occur before any validation!
        // @see AD-784 Reactor Bridge SC - Not enough funds event even when quorum is reached
        if (_votesCount == _quorumCount) {
            return;
        }

        bool _isDecrementAndFirstTime = _claim.shouldDecrementHotWallet && _claim.retryCounter == 0;
        // check token quantity on source if needed
        if (_isDecrementAndFirstTime && !chainTokens.validateRRC(_claim, _index)) {
            // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
            return;
        }

        // update votes count with current validator
        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            uint8 originChainId = _claim.originChainId;
            uint256 _confirmedTxCount = claims.getBatchingTxsCount(originChainId);

            if (_isDecrementAndFirstTime) {
                // refund after failing on destination chain, return funds to hot wallet
                chainTokens.updateTokensRRC(_claim);
            }

            claims.setConfirmedTransactionsRRC(_claim);
            claims.updateNextTimeoutBlockIfNeeded(originChainId, _confirmedTxCount);
        }
    }

    /// @notice Submits a Hot Wallet Increment Claim (HWIC) for processing.
    /// @dev This function processes a claim that increases the hot wallet balance of a specific chain.
    ///      It checks if the quorum of validators has been reached before applying the change to the hot wallet.
    /// @param _claim The hot wallet increment claim containing the chain ID and the amount to be added to the hot wallet.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev The claim is validated by ensuring that a quorum of validators has approved it before proceeding.
    /// @dev If the quorum is reached, the specified amount is added to the hot wallet balance for the given chain.
    function _submitClaimHWIC(HotWalletIncrementClaim calldata _claim, address _caller) internal {
        bytes32 _claimHash = keccak256(abi.encode("HWIC", _claim));
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint8 _quorumCount = validators.getQuorumNumberOfValidators();
        uint256 _votesCount = claimsHelper.numberOfVotes(_claimHash);

        // if quorum is reached, exit MUST occur before any validation!
        if (_votesCount == _quorumCount) {
            return;
        }

        bool _isNewVote = claimsHelper.updateVote(_claimHash, _validatorIdx);
        // check if quorum is reached for the first time
        if (_isNewVote && _votesCount + 1 == _quorumCount) {
            chainTokens.updateTokensHWIC(_claim);
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

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotClaims();
        _;
    }
}
