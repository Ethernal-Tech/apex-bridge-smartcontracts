// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ClaimsManager.sol";
import "./UTXOsManager.sol";
import "./BridgedTokensManager.sol";
import "hardhat/console.sol";

contract BridgeContract is IBridgeContract{

    ClaimsHelper private claimsHelper;
    ClaimsManager private claimsManager;
    UTXOsManager private utxosManager;
    BridgedTokensManager private bridgedTokensManager;

    // mapping in case they could be added/removed
    mapping(address => bool) private isValidator;
    // validatorAddress -> chaindID -> ValidatorCardanoData
    mapping(address => mapping (string => ValidatorCardanoData)) private validatorsCardanoData;  

    mapping(string => bool) private registeredChains;

    // Blochchain ID -> claimsCounter
    mapping(string => uint256) private lastBatchedClaim;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    // BatchId -> SignedBatch[]
    mapping(string => SignedBatch[]) public signedBatches;
    // BlockchaID -> batchId
    mapping(string => string) public lastSignedBatch;

    // BatchId -> ConfirmedBatch
    mapping(string => ConfirmedBatch) public confirmedBatches;
    // BlockchaID -> batchId
    mapping(string => string) public lastConfirmedBatch;

    Chain[] private chains;
    address[] private validatorsAddresses;
    address private owner;
    //TODO: set during initialization
    uint16 private constant MAX_NUMBER_OF_TRANSACTIONS = 1; //intentially set low for testing
    uint8 public constant MAX_NUMBER_OF_BLOCKS = 5;
    uint8 public validatorsCount;
    
    constructor(address[] memory _validators) {
        for (uint i = 0; i < _validators.length; i++) {
            isValidator[_validators[i]] = true;
            validatorsAddresses.push(_validators[i]);
        }
        validatorsCount = uint8(_validators.length);
        owner = msg.sender;
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        claimsManager.submitClaims(_claims, msg.sender);
    }

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {

        claimsManager.setVoted(_signedBatch.id, msg.sender, true);
        claimsManager.setNumberOfVotes(_signedBatch.id);
        signedBatches[_signedBatch.id].push(_signedBatch);

        if (claimsHelper.hasConsensus(_signedBatch.id)) {
            uint256 numberOfSignedBatches = signedBatches[_signedBatch.id].length;
            string[] memory multisigSignatures = new string[](numberOfSignedBatches);
            string[] memory feePayerMultisigSignatures = new string[](numberOfSignedBatches);

            for (uint i = 0; i < numberOfSignedBatches; i++) {
                multisigSignatures[i] = signedBatches[_signedBatch.id][i].multisigSignature;
                feePayerMultisigSignatures[i] = signedBatches[_signedBatch.id][i].feePayerMultisigSignature;
            }

            ConfirmedBatch memory confirmedBatch = ConfirmedBatch(
                _signedBatch.id,
                _signedBatch.rawTransaction,
                multisigSignatures,
                feePayerMultisigSignatures
            );
            
            confirmedBatches[_signedBatch.id] = confirmedBatch;

            currentBatchBlock[_signedBatch.destinationChainId] = int(block.number);

            lastConfirmedBatch[_signedBatch.destinationChainId] = _signedBatch.id;

            lastSignedBatch[_signedBatch.destinationChainId] = _signedBatch.id;

        }
    }

    // Chain registration by Owner
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        uint256 _tokenQuantity
    ) public override onlyOwner {
        _registerChain(_chainId,
                _initialUTXOs,
                _addressMultisig,
                _addressFeePayer,
                _tokenQuantity);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        uint256 _tokenQuantity
    ) external onlyValidator {
        if (registeredChains[_chainId]) {
            revert ChainAlreadyRegistered();
        }
        if (claimsManager.voted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }
        claimsManager.setVoted(_chainId, msg.sender, true);
        claimsManager.setNumberOfVotes(_chainId);
        if (claimsHelper.hasConsensus(_chainId)) {
            _registerChain(_chainId,
                _initialUTXOs,
                _addressMultisig,
                _addressFeePayer,
                _tokenQuantity);
            
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    function _registerChain(string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        uint256 _tokenQuantity) internal {
            registeredChains[_chainId] = true;
            chains.push();
            chains[chains.length - 1].id = _chainId;
            chains[chains.length - 1].utxos = _initialUTXOs;
            chains[chains.length - 1].addressMultisig = _addressMultisig;
            chains[chains.length - 1].addressFeePayer = _addressFeePayer;
            chains[chains.length - 1].tokenQuantity = _tokenQuantity;

            utxosManager.pushUTXOs(_chainId, _initialUTXOs);

            bridgedTokensManager.setTokenQuantity(_chainId, _tokenQuantity);

            nextTimeoutBlock[_chainId] = block.number + MAX_NUMBER_OF_BLOCKS;
            
            emit newChainRegistered(_chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) public view override returns (bool batch) {

        // TO DO: Check the logic, this will check if there is "pending" signedBatch from this validator, 
        // I do not see how to check if the batch is related to pending claims, so my guess is that no new 
        // batch should be created if there's "pending" batch
        if(!claimsManager.voted(lastConfirmedBatch[_destinationChain], msg.sender)) {

            if ((claimsManager.claimsCounter(_destinationChain) - lastBatchedClaim[_destinationChain]) >= MAX_NUMBER_OF_TRANSACTIONS) {
                return true;
            }

            if ((block.number >= nextTimeoutBlock[_destinationChain])) {
                return true;
            }
        }

        return false;
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if(shouldCreateBatch(_destinationChain)) {
            uint256 lastBatchedClaimNumber = lastBatchedClaim[_destinationChain];
            uint256 lastConfirmedClaim = claimsManager.claimsCounter(_destinationChain);
            uint256 lastClaimToInclude = ((lastConfirmedClaim - lastBatchedClaimNumber) >= MAX_NUMBER_OF_TRANSACTIONS) 
                ? lastBatchedClaimNumber + MAX_NUMBER_OF_TRANSACTIONS : lastConfirmedClaim;
            
            uint256 counterConfirmedTransactions;
            uint256 arraySize;

            //TODO: is there a better way?, need to know how big will the array be
            for (uint i = lastBatchedClaimNumber; i < lastClaimToInclude; i++) {
                ClaimTypes claimType = claimsManager.queuedClaimsTypes(_destinationChain, i);
                if(claimType == ClaimTypes.BRIDGING_REQUEST) {
                    arraySize++;
                }
            }

            ConfirmedTransaction[] memory confirmedTransactions = new ConfirmedTransaction[](arraySize);

            for (uint i = lastBatchedClaimNumber; i < lastClaimToInclude; i++) {
                ClaimTypes claimType = claimsManager.queuedClaimsTypes(_destinationChain, i);

                if(claimType == ClaimTypes.BRIDGING_REQUEST) {
                    Receiver[] memory tempReceivers = claimsHelper.getClaimBRC(claimsManager.queuedClaims(_destinationChain, i)).receivers;
                    ConfirmedTransaction memory confirmedtransaction = ConfirmedTransaction(
                        i,
                        tempReceivers
                    );
                    confirmedTransactions[counterConfirmedTransactions] = confirmedtransaction;
                    counterConfirmedTransactions++;
                }
            }
            return confirmedTransactions;
        }
    }

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig address
    // that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external override view returns (UTXOs memory availableUTXOs) {
        return utxosManager.getAvailableUTXOs(_destinationChain, txCost);
    }

    function updateUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaimsManager {   
        utxosManager.updateUTXOs(_chainID, _outputUTXOs);
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
        return confirmedBatches[_destinationChain];
    }

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (string memory blockHash) {
        return claimsHelper.lastObserveredBlock(_sourceChain);
    }

    function getLastConfirmedBatch(string calldata _chainID) external view returns (string memory) {
        return lastConfirmedBatch[_chainID];

    }
    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function isChainRegistered(string calldata _chainId) external view override returns (bool) {
        return registeredChains[_chainId];
    }

    function getValidatorsCount() external view override returns (uint8) {
        return validatorsCount;
    }

    function getNumberOfVotes(string calldata _id) external view override returns (uint8) {
        return claimsManager.numberOfVotes(_id);
    }

    function setValidatorCardanoData(ValidatorCardanoData calldata _validatorCardanoData, string calldata _chainID) external {
        validatorsCardanoData[msg.sender][_chainID] = _validatorCardanoData;
    }

    // TODO: who is calling this?
    function getValidatorsCardanoData(string calldata _chainID) external view returns (ValidatorCardanoData[] memory) {
        ValidatorCardanoData[] memory _validatorsCardanoData = new ValidatorCardanoData[](validatorsAddresses.length);
        for (uint i = 0; i < validatorsAddresses.length; i++) {
            _validatorsCardanoData[i] = validatorsCardanoData[validatorsAddresses[i]][_chainID];
        }
        return _validatorsCardanoData;
    }

    function setCurrentBatchBlock(string calldata _chainId, int256 _blockNumber) external onlyClaimsManager {
        currentBatchBlock[_chainId] = int(_blockNumber);
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyClaimsManager {
        nextTimeoutBlock[_chainId] = _blockNumber;
    }

    function setClaimsHelper(address _claimsHelper) external onlyOwner {
        claimsHelper = ClaimsHelper(_claimsHelper);
    }

    function setClaimsManager(address _claimsManager) external onlyOwner {
        claimsManager = ClaimsManager(_claimsManager);
    }

    function setUTXOsManager(address _utxosManager) external onlyOwner {
        utxosManager = UTXOsManager(_utxosManager);
    }

    function setBridgedTokensManager(address _bridgedTokensManager) external onlyOwner {
        bridgedTokensManager = BridgedTokensManager(_bridgedTokensManager);
    }

    modifier onlyValidator() {
        if (!isValidator[msg.sender]) revert NotValidator();
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