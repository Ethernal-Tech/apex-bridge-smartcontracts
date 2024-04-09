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
    ValidatorsContract private validatorsContract;
    ClaimsManager private claimsManager;
    UTXOsManager private utxosManager;
    SignedBatchManager private signedBatchManager;
    SlotsManager private slotsManager;

    // BlockchainID -> bool
    mapping(string => bool) public isChainRegistered;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    Chain[] private chains;

    address private owner;
    uint16 private maxNumberOfTransactions;
    uint8 private timeoutBlocksNumber;
    
    constructor(uint16 _maxNumberOfTransactions, uint8 _timeoutBlocksNumber) {
        owner = msg.sender;
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
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
        signedBatchManager.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Slots
    function submitLastObservableBlocks(
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
        string calldata _validationSignature,
        uint256 _tokenQuantity
    ) external override onlyValidator {
        if (isChainRegistered[_chainId]) {
            revert ChainAlreadyRegistered(_chainId);
        }
        if (claimsManager.voted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        Chain memory _chain = Chain(
            _chainId,
            _initialUTXOs,
            _addressMultisig,
            _addressFeePayer,
            _tokenQuantity
        );
        bytes32 chainHash = keccak256(abi.encode(_chain));

        claimsManager.setVoted(_chainId, msg.sender, true);
        claimsManager.setNumberOfVotes(chainHash);
        validatorsContract.addValidatorCardanoData(_chainId, msg.sender, _validator);

        if (claimsManager.numberOfVotes(chainHash) == validatorsContract.getValidatorsCount()) {
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
        isChainRegistered[_chainId] = true;
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;
        chains[chains.length - 1].tokenQuantity = _tokenQuantity;

        utxosManager.setInitialUTxOs(_chainId, _initialUTXOs);

        claimsManager.setTokenQuantity(_chainId, _tokenQuantity);

        signedBatchManager.resetCurrentBatchBlock(_chainId);

        nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;

        emit newChainRegistered(_chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) public view override returns (bool batch) {
        if (
            signedBatchManager.isBatchCreated(_destinationChain) ||
            signedBatchManager.isBatchAlreadySubmittedBy(_destinationChain, msg.sender)
        ) {
            return false;
        }

        uint256 cnt = getBatchingTxsCount(_destinationChain);
        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function getNextBatchId(string calldata _destinationChain) external view override returns (uint256 result) {
        if (!shouldCreateBatch(_destinationChain)) {
            return 0;
        }

        return signedBatchManager.getNewBatchId(_destinationChain);
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint256 firstTxNonce = claimsManager.getLastBatchedTxNonce(_destinationChain) + 1;

        uint256 counterConfirmedTransactions = getBatchingTxsCount(_destinationChain);
        _confirmedTransactions = new ConfirmedTransaction[](counterConfirmedTransactions);

        for (uint i = 0; i < counterConfirmedTransactions; i++) {
            _confirmedTransactions[i] = claimsManager.getConfirmedTransaction(_destinationChain, firstTxNonce + i);
        }

        return _confirmedTransactions;
    }

    function getBatchingTxsCount(string calldata _chainId) public view returns (uint256 counterConfirmedTransactions) {
        uint256 lastConfirmedTxNonce = claimsManager.getLastConfirmedTxNonce(_chainId);
        uint256 lastBatchedTxNonce = claimsManager.getLastBatchedTxNonce(_chainId);

        uint256 txsToProcess = ((lastConfirmedTxNonce - lastBatchedTxNonce) >= maxNumberOfTransactions)
            ? maxNumberOfTransactions
            : (lastConfirmedTxNonce - lastBatchedTxNonce);

        counterConfirmedTransactions = 0;

        while (counterConfirmedTransactions < txsToProcess) {
            ConfirmedTransaction memory confirmedTx = claimsManager.getConfirmedTransaction(
                _chainId,
                lastBatchedTxNonce + counterConfirmedTransactions + 1
            );
            if (confirmedTx.blockHeight >= nextTimeoutBlock[_chainId]) {
                break;
            }
            counterConfirmedTransactions++;
        }
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

    function getRawTransactionFromLastBatch(string calldata _destinationChain) external view returns (bytes memory) {
        return signedBatchManager.getRawTransactionFromLastBatch(_destinationChain);
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyClaimsManager {
        nextTimeoutBlock[_chainId] = _blockNumber + maxNumberOfTransactions;
    }

    function setClaimsManager(address _claimsManager) external onlyOwner {
        claimsManager = ClaimsManager(_claimsManager);
    }

    function setSignedBatchManager(address _signedBatchManager) external onlyOwner {
        signedBatchManager = SignedBatchManager(_signedBatchManager);
    }

    function setUTXOsManager(address _utxosManager) external onlyOwner {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setSlotsManager(SlotsManager _slotsManager) external onlyOwner {
        slotsManager = SlotsManager(_slotsManager);
    }

    function setValidatorsContract(ValidatorsContract _validatorsContract) external onlyOwner {
        validatorsContract = ValidatorsContract(_validatorsContract);
    }

    modifier onlyValidator() {
        if (!validatorsContract.isValidator(msg.sender)) revert NotValidator();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }
}
