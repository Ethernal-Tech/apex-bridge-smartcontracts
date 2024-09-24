// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./Claims.sol";
import "./SignedBatches.sol";
import "./Slots.sol";
import "./Validators.sol";

contract Bridge is IBridge, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    Claims private claims;
    SignedBatches private signedBatches;
    Slots private slots;
    Validators private validators;

    Chain[] private chains;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _claimsAddress,
        address _signedBatchesAddress,
        address _slotsAddress,
        address _validatorsAddress
    ) external onlyOwner {
        claims = Claims(_claimsAddress);
        signedBatches = SignedBatches(_signedBatchesAddress);
        slots = Slots(_slotsAddress);
        validators = Validators(_validatorsAddress);
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        claims.submitClaims(_claims, msg.sender);
    }

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!claims.shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
        }

        if (
            !validators.areSignaturesValid(
                _signedBatch.destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.signature,
                _signedBatch.feeSignature,
                msg.sender
            )
        ) {
            revert InvalidSignature();
        }
        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Batches
    function submitSignedBatchEVM(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!claims.shouldCreateBatch(_signedBatch.destinationChainId)) {
            return;
        }

        if (
            !validators.isBlsSignatureValidByValidatorAddress(
                _signedBatch.destinationChainId,
                keccak256(_signedBatch.rawTransaction),
                _signedBatch.signature,
                msg.sender
            )
        ) {
            revert InvalidSignature();
        }
        signedBatches.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Slots
    function submitLastObservedBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks) external override onlyValidator {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }
        slots.updateBlocks(_chainId, _blocks, msg.sender);
    }

    // Chain registration by Owner
    function setChainAdditionalData(
        uint8 _chainId,
        string calldata addressMultisig,
        string calldata addressFeePayer
    ) external override onlyOwner {
        if (!claims.isChainRegistered(_chainId)) {
            revert ChainIsNotRegistered(_chainId);
        }
        for (uint i = 0; i < chains.length; i++) {
            if (chains[i].id == _chainId) {
                chains[i].addressMultisig = addressMultisig;
                chains[i].addressFeePayer = addressFeePayer;
                break;
            }
        }
    }

    // Chain registration by Owner
    function registerChain(
        Chain calldata _chain,
        uint256 _tokenQuantity,
        ValidatorAddressChainData[] calldata _chainDatas
    ) public override onlyOwner {
        validators.setValidatorsChainData(_chain.id, _chainDatas);
        _registerChain(_chain, _tokenQuantity);
    }

    function registerChainGovernance(
        uint8 _chainId,
        uint8 _chainType,
        uint256 _tokenQuantity,
        ValidatorChainData calldata _validatorChainData
    ) external override onlyValidator {
        if (claims.isChainRegistered(_chainId)) {
            revert ChainAlreadyRegistered(_chainId);
        }

        bytes32 chainHash = keccak256(abi.encode(_chainId, _chainType, _tokenQuantity));

        if (claims.hasVoted(chainHash, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        // TODO:
        // if _chain.chainType == 1 verify signatures for both verifyingKey and verifyingFeeKey
        // if _chain.chainType == 2 verify signatures for BLS specified in verifyingKey

        validators.addValidatorChainData(_chainId, msg.sender, _validatorChainData);

        if (claims.setVoted(msg.sender, chainHash) == validators.validatorsCount()) {
            _registerChain(Chain(_chainId, _chainType, "", ""), _tokenQuantity);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    function _registerChain(Chain memory _chain, uint256 _tokenQuantity) internal {
        chains.push(_chain);

        uint8 _chainId = _chain.id;
        claims.setChainRegistered(_chainId, _tokenQuantity);
        emit newChainRegistered(_chainId);
    }

    // Queries

    // True if there are enough confirmed transactions or the timeout between two batches is exceeded.
    function shouldCreateBatch(uint8 _destinationChain) public view override returns (bool _batch) {
        return claims.shouldCreateBatch(_destinationChain);
    }

    function getNextBatchId(uint8 _destinationChain) external view override returns (uint64 _result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        uint64 batchId = signedBatches.getConfirmedBatchId(_destinationChain);

        return batchId + 1;
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        uint8 _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!claims.shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint64 firstTxNonce = claims.lastBatchedTxNonce(_destinationChain) + 1;

        uint64 counterConfirmedTransactions = claims.getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint64 i; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = claims.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    function getConfirmedBatch(uint8 _destinationChain) external view override returns (ConfirmedBatch memory _batch) {
        return signedBatches.getConfirmedBatch(_destinationChain);
    }

    function getValidatorsChainData(uint8 _chainId) external view override returns (ValidatorChainData[] memory) {
        return validators.getValidatorsChainData(_chainId);
    }

    function getLastObservedBlock(uint8 _sourceChain) external view override returns (CardanoBlock memory _cblock) {
        return slots.getLastObservedBlock(_sourceChain);
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function getRawTransactionFromLastBatch(uint8 _destinationChain) external view override returns (bytes memory) {
        return signedBatches.getConfirmedBatchTransaction(_destinationChain);
    }

    modifier onlyValidator() {
        if (!validators.isValidator(msg.sender)) revert NotValidator();
        _;
    }
}
