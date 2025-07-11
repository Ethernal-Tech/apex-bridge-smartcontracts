// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./interfaces/ConstantsLib.sol";
import "./Utils.sol";
import "./Bridge.sol";
import "./Claims.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

/// @title Claims
/// @notice Handles validator-submitted claims in a cross-chain bridge system.
/// @dev Inherits from OpenZeppelin upgradeable contracts for upgradability and ownership control.
contract SpecialClaims is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using ConstantsLib for uint8;

    address private upgradeAdmin;
    address private bridgeAddress;
    Claims private claims;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    /// @notice Mapping of confirmed signed batches
    /// @dev BlockchainId -> batchId -> SignedBatch
    mapping(uint8 => mapping(uint64 => ConfirmedSignedBatchData)) public confirmedSpecialSignedBatches;

    /// @notice Stores the last special confirmed batch per destination chain
    /// @dev BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastSpecialConfirmedBatch;

    // @notice Bitmap used to flag chains for which special task has been executed
    uint8 public bitmap;

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
    /// @param _bridgeAddress Address of the Bridge contract.
    /// @param _claimsAddress Address of the Claims contract.
    /// @param _claimsHelperAddress Address of the ClaimsHelper contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    function submitSpecialClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 notUsedClaims = _claims.bridgingRequestClaims.length +
            _claims.refundRequestClaims.length +
            _claims.hotWalletIncrementClaims.length;

        if (notUsedClaims != 0) {
            revert WrongSpecialClaims();
        }
        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;

        uint256 claimsLength = batchExecutedClaimsLength + batchExecutionFailedClaimsLength;

        if (claimsLength > claims.MAX_NUMBER_OF_CLAIMS()) {
            revert TooManyClaims(claimsLength, claims.MAX_NUMBER_OF_CLAIMS());
        }

        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!claims.isChainRegistered(_claim.chainId)) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitSpecialClaimsBEC(_claim, _caller);
        }

        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!claims.isChainRegistered(_claim.chainId)) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitSpecialClaimsBEFC(_claim, _caller);
        }
    }

    /// @notice Submits a Batch Executed Claim (BEC) for updating validator set.
    /// @dev This function checks if a batch has already been processed, validates the claim, and updates the state
    ///      by resetting the current batch block, updating the last transaction nonce, and managing timeout blocks.
    /// @param _claim The batch executed claim containing the details of the batch execution.
    /// @param _caller The address of the caller who is submitting the claim.
    /// @dev If the batch has already been processed (first and last transaction nonces are zero), the function exits early
    ///      to prevent double-processing of the same batch.
    /// @dev A quorum of validators is required to approve the claim before proceeding.
    /// @dev The claim's corresponding signed batch data is deleted once the claim is processed.
    function _submitSpecialClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getSpecialConfirmedSignedBatchData(
            chainId,
            batchId
        );

        if (
            _confirmedSignedBatch.firstTxNonceId != (2 ** 64 - 1) &&
            _confirmedSignedBatch.lastTxNonceId != (2 ** 64 - 1)
        ) {
            // special batch must have first and last transaction nonces set to 2^64 - 1
            return;
        }

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.BATCH_IN_PROGRESS) {
            return;
        }

        bytes32 claimHash = keccak256(abi.encode("SBEC", _claim));

        uint8 _validatorIdx = validators.getValidatorIndex(msg.sender) - 1;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
            _validatorIdx,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            claimsHelper.setSpecialConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.BATCH_EXECUTED);

            // isCondolidation flag is here used to signal the last special signed batch for a change
            // since there could be multiple special signed batches needed to transfer all the funds
            if (_confirmedSignedBatch.batchType == BatchTypesLib.CONSOLIDATION) {
                bitmap |= uint8(1 << chainId);
            }

            // Check if all chains have been processed
            if (_countSetBits(bitmap) == Bridge(bridgeAddress).getAllRegisteredChains().length) {
                //TODO call stakeManager
            }
        }
    }

    //TODO explanation
    function _submitSpecialClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;

        ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getSpecialConfirmedSignedBatchData(
            chainId,
            batchId
        );

        if (
            _confirmedSignedBatch.firstTxNonceId != (2 ** 64 - 1) &&
            _confirmedSignedBatch.lastTxNonceId != (2 ** 64 - 1)
        ) {
            // special batch must have first and last transaction nonces set to 2^64 - 1
            return;
        }

        // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
        // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
        // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
        // and also to prevent processing of batches with invalid IDs.
        // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
        if (_confirmedSignedBatch.status != ConstantsLib.BATCH_IN_PROGRESS) {
            return;
        }

        bytes32 claimHash = keccak256(abi.encode("SBEFC", _claim));

        uint8 _validatorIdx = validators.getValidatorIndex(msg.sender) - 1;

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeededReturnQuorumReached(
            _validatorIdx,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            claimsHelper.setSpecialConfirmedSignedBatchStatus(chainId, batchId, ConstantsLib.BATCH_FAILED);

            emit SpecialSignedBatchExecutionFailed(chainId, batchId);
        }
    }

    function _countSetBits(uint256 _bitmap) internal pure returns (uint256 count) {
        while (_bitmap != 0) {
            _bitmap &= (_bitmap - 1);
            count++;
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

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
