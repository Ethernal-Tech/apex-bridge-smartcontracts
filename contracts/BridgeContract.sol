// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContract.sol";
import "./ClaimsHelper.sol";
import "./SlotsManager.sol";
import "./ClaimsManager.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "./ValidatorsContract.sol";
import "hardhat/console.sol";

contract BridgeContract is IBridgeContract {
    ClaimsManager private claimsManager;
    SignedBatchManager private signedBatchManager;
    SlotsManager private slotsManager;
    UTXOsManager private utxosManager;
    ValidatorsContract private validatorsContract;

    address private owner;

    Chain[] private chains;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(
        address _claimsManagerAddress,
        address _signedBatchManagerAddress,
        address _slotsManagerAddress,
        address _utxosManagerAddress,
        address _validatorsContractAddress
    ) external onlyOwner {
        claimsManager = ClaimsManager(_claimsManagerAddress);
        signedBatchManager = SignedBatchManager(_signedBatchManagerAddress);
        slotsManager = SlotsManager(_slotsManagerAddress);
        utxosManager = UTXOsManager(_utxosManagerAddress);
        validatorsContract = ValidatorsContract(_validatorsContractAddress);
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        claimsManager.submitClaims(_claims, msg.sender);
    }

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {
        if (!shouldCreateBatch(_signedBatch.destinationChainId)) {
            // it will revert also if chain is not registered
            revert CanNotCreateBatchYet(_signedBatch.destinationChainId);
        }
        if (
            !validatorsContract.isSignatureValid(
                _signedBatch.destinationChainId,
                _signedBatch.rawTransaction,
                _signedBatch.multisigSignature,
                _signedBatch.feePayerMultisigSignature,
                msg.sender
            )
        ) {
            revert InvalidSignature();
        }
        signedBatchManager.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Slots
    function submitLastObservedBlocks(
        string calldata chainID,
        CardanoBlock[] calldata blocks
    ) external override onlyValidator {
        slotsManager.updateBlocks(chainID, blocks, msg.sender);
    }

    // Chain registration by Owner
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorAddressCardanoData[] calldata validators,
        uint256 _tokenQuantity
    ) public override onlyOwner {
        validatorsContract.setValidatorsCardanoData(_chainId, validators);
        _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _tokenQuantity);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        ValidatorCardanoData calldata _validator,
        uint256 _tokenQuantity
    ) external override onlyValidator {
        if (claimsManager.isChainRegistered(_chainId)) {
            revert ChainAlreadyRegistered(_chainId);
        }
        if (claimsManager.getVoted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        ChainWithoutSignatures memory _chain = ChainWithoutSignatures(
            _chainId,
            _initialUTXOs,
            _addressMultisig,
            _addressFeePayer,
            _tokenQuantity
        );
        bytes32 chainHash = keccak256(abi.encode(_chain));

        claimsManager.setVoted(_chainId, msg.sender, true);
        claimsManager.incrementNumberOfVotes(chainHash);
        validatorsContract.addValidatorCardanoData(_chainId, msg.sender, _validator);

        if (claimsManager.getNumberOfVotes(chainHash) == validatorsContract.getValidatorsCount()) {
            _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _tokenQuantity);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    function _registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        uint256 _tokenQuantity
    ) internal {
        claimsManager.setChainRegistered(_chainId);
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;
        chains[chains.length - 1].tokenQuantity = _tokenQuantity;

        utxosManager.setInitialUTxOs(_chainId, _initialUTXOs);

        claimsManager.setTokenQuantity(_chainId, _tokenQuantity);

        claimsManager.resetCurrentBatchBlock(_chainId);

        claimsManager.setNextTimeoutBlock(_chainId, block.number);

        emit newChainRegistered(_chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) public view override returns (bool batch) {
        if (
            claimsManager.isBatchCreated(_destinationChain) ||
            signedBatchManager.isBatchAlreadySubmittedBy(_destinationChain, msg.sender)
        ) {
            return false;
        }

        return claimsManager.shouldCreateBatch(_destinationChain);
    }

    function getNextBatchId(string calldata _destinationChain) external view override returns (uint256 result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        (uint256 batchId, ) = signedBatchManager.lastConfirmedBatch(_destinationChain);

        return batchId + 1;
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint256 firstTxNonce = claimsManager.lastBatchedTxNonce(_destinationChain) + 1;

        uint256 counterConfirmedTransactions = claimsManager.getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint i = 0; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = claimsManager.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    function getAvailableUTXOs(
        string calldata _destinationChain
    ) external view override returns (UTXOs memory availableUTXOs) {
        return utxosManager.getChainUTXOs(_destinationChain);
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
        return signedBatchManager.getConfirmedBatch(_destinationChain);
    }

    function getValidatorsCardanoData(
        string calldata _chainId
    ) external view override returns (ValidatorCardanoData[] memory validators) {
        return validatorsContract.getValidatorsCardanoData(_chainId);
    }

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (CardanoBlock memory cblock) {
        return slotsManager.getLastObservedBlock(_sourceChain);
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function getRawTransactionFromLastBatch(
        string calldata _destinationChain
    ) external view override returns (string memory) {
        (, string memory _rawTransaction) = signedBatchManager.lastConfirmedBatch(_destinationChain);
        return _rawTransaction;
    }

    modifier onlyValidator() {
        if (!validatorsContract.isValidator(msg.sender)) revert NotValidator();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
}
