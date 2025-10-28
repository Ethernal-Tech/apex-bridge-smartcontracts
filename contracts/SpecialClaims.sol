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
import "./SignedBatches.sol";
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
    SignedBatches private signedBatches;
    Validators private validators;

    /// @notice Mapping of confirmed signed batches
    /// @dev BlockchainId -> batchId -> SignedBatch
    mapping(uint8 => mapping(uint64 => ConfirmedSignedBatchData)) public confirmedSpecialSignedBatches;

    /// @notice Stores the last special confirmed batch per destination chain
    /// @dev BlockchainId -> ConfirmedBatch
    mapping(uint8 => ConfirmedBatch) private lastSpecialConfirmedBatch;

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
    /// @param _signedBatchesAddress Address of the SignedBatches contract.
    /// @param _validatorsAddress Address of the Validators contract.
    function setDependencies(
        address _bridgeAddress,
        address _claimsAddress,
        address _claimsHelperAddress,
        address _signedBatchesAddress,
        address _validatorsAddress
    ) external onlyOwner {
        if (
            !_isContract(_bridgeAddress) ||
            !_isContract(_claimsAddress) ||
            !_isContract(_claimsHelperAddress) ||
            !_isContract(_signedBatchesAddress) ||
            !_isContract(_validatorsAddress)
        ) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        claims = Claims(_claimsAddress);
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        validators = Validators(_validatorsAddress);
    }

    function submitSpecialClaims(SpecialValidatorClaims calldata _claims, address _caller) external view onlyBridge {
        //TODO temp unused
        if (address(_caller) == address(0)) revert ZeroAddress();

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

            // _submitSpecialClaimsBEC(_claim, _caller);
        }

        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!claims.isChainRegistered(_claim.chainId)) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            // _submitSpecialClaimsBEFC(_claim, _caller);
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
    // function _submitSpecialClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
    //     uint8 chainId = _claim.chainId;
    //     uint64 batchId = _claim.batchNonceId;

    //     //TODO first and last check comment
    //     ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSpecialSignedBatchData(
    //         chainId,
    //         batchId
    //     );

    //     // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
    //     // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
    //     // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
    //     // and also to prevent processing of batches with invalid IDs.
    //     // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
    //     if (_confirmedSignedBatch.status != ConstantsLib.BATCH_IN_PROGRESS) {
    //         return;
    //     }

    //     bytes32 claimHash = keccak256(abi.encode("SBEC", _claim));

    //     bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
    //         _caller,
    //         claimHash,
    //         validators.getQuorumNumberOfValidators()
    //     );

    //     if (_quorumReached) {
    //         claimsHelper.setConfirmedSpecialSignedBatchStatus(chainId, batchId, ConstantsLib.BATCH_EXECUTED);

    //         ValidatorSet[] memory _newValidatorSet = validators.getNewValidatorSet();

    //         uint256 _newValidatorSetLength = _newValidatorSet.length;

    //         for (uint256 i; i < _newValidatorSetLength; i++) {
    //             ValidatorSet memory _validatorSet = _newValidatorSet[i];

    //             // validators.setValidatorsChainData(_validatorSet.chain.id, _validatorSet.validators);

    //             //TODO update chain data
    //         }

    //         //TODO Nexus update confirmation is needed
    //     }
    // }

    // function _submitSpecialClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
    //     uint8 chainId = _claim.chainId;
    //     uint64 batchId = _claim.batchNonceId;

    //     ConfirmedSignedBatchData memory _confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
    //         chainId,
    //         batchId
    //     );

    //     //TODO first and last check comment
    //     // Once a quorum has been reached on either BEC or BEFC for a batch, the first and last transaction
    //     // nonces for that batch are deleted, thus signaling that the batch has been processed. Any further BEC or BEFC
    //     // claims for the same batch will not be processed. This is to prevent double processing of the same batch,
    //     // and also to prevent processing of batches with invalid IDs.
    //     // Since ValidatorClaims could have other valid claims, we do not revert here, instead we do early exit.
    //     if (_confirmedSignedBatch.status != ConstantsLib.BATCH_IN_PROGRESS) {
    //         return;
    //     }

    //     bytes32 claimHash = keccak256(abi.encode("SBEFC", _claim));

    //     bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
    //         _caller,
    //         claimHash,
    //         validators.getQuorumNumberOfValidators()
    //     );

    //     if (_quorumReached) {
    //         claimsHelper.setConfirmedSpecialSignedBatchStatus(chainId, batchId, ConstantsLib.BATCH_FAILED);

    //         //TODO ?
    //     }
    // }

    /// @notice Registers a vote for a specific voter and claim hash.
    /// @param _voter The address of the voter casting the vote.
    /// @param _hash The hash of the claim or event the voter is voting on.
    /// @return The updated vote count for the specific claim or event.

    function setVoted(address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_voter, _hash);
    }

    /// @notice Checks whether a specific voter has already voted for a given claim hash.
    /// @param _hash The hash of the claim being voted on.
    /// @param _voter The address of the voter to check.
    /// @return True if the voter has voted for the given claim hash, false otherwise.
    function hasVoted(bytes32 _hash, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_hash, _voter);
    }

    /// @notice Retrieves a status for a specific batch on a given chain.
    /// @param _chainId The ID of the chain on which the batch exists.
    /// @param _batchId The ID of the batch to retrieve transactions for.
    /// @return status A status code indicating the success or failure of the operation.
    function getSpecialBatchStatus(uint8 _chainId, uint64 _batchId) external view returns (uint8 status) {
        return confirmedSpecialSignedBatches[_chainId][_batchId].status;
    }

    /// @notice Submits a special signed batch for updating validator set.
    /// @dev This function checks batch sequencing, validates votes, and finalizes the batch if quorum is met.
    /// @param _signedBatch The signed batch containing transaction details and validator signatures.
    /// @param _caller The address of the validator submitting the batch.
    /// Requirements:
    /// - Caller must be the bridge contract.
    /// - The batch must have the expected sequential ID.
    /// - The caller must not have already voted on this batch hash.
    /// - If quorum is reached after this vote, the batch is confirmed and stored, and temporary data is cleared.
    function submitSpecialSignedBatch(SignedBatch calldata _signedBatch, address _caller) external onlyBridge {
        uint8 _destinationChainId = _signedBatch.destinationChainId;
        uint64 _sbId = lastSpecialConfirmedBatch[_destinationChainId].id + 1;

        if (_signedBatch.id != _sbId) {
            return; // skip if this is not batch we are expecting
        }

        bytes32 _sbHash = keccak256(
            abi.encodePacked(
                _signedBatch.id,
                _signedBatch.firstTxNonceId,
                _signedBatch.lastTxNonceId,
                _destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.isConsolidation
            )
        );

        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint256 _bitmapValue = signedBatches.bitmap(_sbHash);
        uint256 _bitmapNewValue;
        unchecked {
            _bitmapNewValue = _bitmapValue | (1 << _validatorIdx);
        }

        // check if caller already voted for same hash and skip if he did
        if (_bitmapValue == _bitmapNewValue) {
            return;
        }

        uint256 _quorumCount = validators.getQuorumNumberOfValidators();

        (uint256 _numberOfVotes, ) = signedBatches.getNumberOfSignatures(_sbHash);

        signedBatches.addSignature(_sbHash, _signedBatch.signature);
        signedBatches.addFeeSignature(_sbHash, _signedBatch.feeSignature);
        signedBatches.setBitmap(_sbHash, _bitmapNewValue);

        // check if quorum reached (+1 is last vote)
        if (_numberOfVotes + 1 >= _quorumCount) {
            lastSpecialConfirmedBatch[_destinationChainId] = ConfirmedBatch(
                signedBatches.getSignatures(_sbHash),
                signedBatches.getFeeSignatures(_sbHash),
                signedBatches.bitmap(_sbHash),
                _signedBatch.rawTransaction,
                _sbId,
                _signedBatch.isConsolidation
            );

            claimsHelper.setConfirmedSignedBatchData(_signedBatch);

            //TODO update chains
            // Chain[] memory _chains = bridge.getChains();

            signedBatches.deleteSignaturesFeeSignaturesBitmap(_sbHash);
        }
    }

    function getSpecialConfirmedBatchId(uint8 _destinationChain) external view returns (uint64) {
        return lastSpecialConfirmedBatch[_destinationChain].id;
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
