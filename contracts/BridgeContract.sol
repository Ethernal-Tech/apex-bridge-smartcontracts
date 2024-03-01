// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";
import "./BridgeContractClaimsManager.sol";

contract BridgeContract is IBridgeContract{

    BridgeContractClaimsManager private bccm;

    // mapping in case they could be added/removed
    mapping(address => bool) private validators;
    mapping(address => bytes32) private validatorsPrivateKeyHashes;  

    mapping(string => bool) private registeredChains;
    // BLockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;

    // Blochchain ID -> claimsCounter
    mapping(string => uint256) private lastBatchedClaim;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    // BatchId -> SignedBatch[]
    mapping(string => SignedBatch[]) public signedBatches;

    // BatchId -> ConfirmedBatch
    mapping(string => ConfirmedBatch) private confirmedBatches;
    // BlockchaID -> batchId
    mapping(string => string) private lastConfirmedBatch;

    Chain[] private chains;
    address[] private validatorsAddresses;
    address private owner;
    uint16 private constant MAX_NUMBER_OF_TRANSACTIONS = 1; //intentially set low for testing
    uint8 public constant MAX_NUMBER_OF_BLOCKS = 5;
    
    constructor(address[] memory _validators) {
        for (uint i = 0; i < _validators.length; i++) {
            validators[_validators[i]] = true;
        }
        bccm = new BridgeContractClaimsManager();
        bccm.setValidatorsCount(uint8(_validators.length));
        owner = msg.sender;
    }

    // Claims
    function submitClaims(ValidatorClaims calldata _claims) external override onlyValidator {
        bccm.submitClaims(_claims, msg.sender);
    }

    // Batches
    function submitSignedBatch(SignedBatch calldata _signedBatch) external override onlyValidator {

        bccm.setVoted(_signedBatch.id, msg.sender, true);
        bccm.setNumberOfVotes(_signedBatch.id);
        signedBatches[_signedBatch.id].push(_signedBatch);

        if (bccm.hasConsensus(_signedBatch.id)) {
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
        }
    }

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external override onlyOwner {
        registeredChains[_chainId] = true;
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;

        for (uint i = 0; i < _initialUTXOs.multisigOwnedUTXOs.length; i++) {
            chainUTXOs[_chainId].multisigOwnedUTXOs.push(_initialUTXOs.multisigOwnedUTXOs[i]);
        }
        for (uint i = 0; i < _initialUTXOs.feePayerOwnedUTXOs.length; i++) {
            chainUTXOs[_chainId].feePayerOwnedUTXOs.push(_initialUTXOs.feePayerOwnedUTXOs[i]);
        }

        nextTimeoutBlock[_chainId] = block.number + MAX_NUMBER_OF_BLOCKS;

        emit newChainRegistered(_chainId);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external onlyValidator {
        if (registeredChains[_chainId]) {
            revert ChainAlreadyRegistered();
        }
        if (bccm.voted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }
        bccm.setVoted(_chainId, msg.sender, true);
        bccm.setNumberOfVotes(_chainId);
        if (bccm.hasConsensus(_chainId)) {
            registeredChains[_chainId] = true;
            chains.push();
            chains[chains.length - 1].id = _chainId;
            chains[chains.length - 1].utxos = _initialUTXOs;
            chains[chains.length - 1].addressMultisig = _addressMultisig;
            chains[chains.length - 1].addressFeePayer = _addressFeePayer;

            for (uint i = 0; i < _initialUTXOs.multisigOwnedUTXOs.length; i++) {
                chainUTXOs[_chainId].multisigOwnedUTXOs.push(_initialUTXOs.multisigOwnedUTXOs[i]);
            }
            for (uint i = 0; i < _initialUTXOs.feePayerOwnedUTXOs.length; i++) {
                chainUTXOs[_chainId].feePayerOwnedUTXOs.push(_initialUTXOs.feePayerOwnedUTXOs[i]);
            }

            nextTimeoutBlock[_chainId] = block.number + MAX_NUMBER_OF_BLOCKS;
            
            emit newChainRegistered(_chainId);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) external view override returns (bool batch) {

        return _shouldCreateBatch(_destinationChain);
    }

    function _shouldCreateBatch(string calldata _destinationChain) internal view returns (bool) {
        // TO DO: Check the logic, this will check if there is "pending" signedBatch from this validator, 
        // I do not see how to check if the batch is related to pending claims, so my guess is that no new 
        // batch should be created if there's "pending" batch
        if(!bccm.voted(lastConfirmedBatch[_destinationChain], msg.sender)) {

            if ((bccm.claimsCounter(_destinationChain) - lastBatchedClaim[_destinationChain]) >= MAX_NUMBER_OF_TRANSACTIONS) {
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
        if(_shouldCreateBatch(_destinationChain)) {
            uint256 lastBatchedClaimNumber = lastBatchedClaim[_destinationChain];
            uint256 lastConfirmedClaim = bccm.claimsCounter(_destinationChain);
            uint256 lastClaimToInclude = ((lastConfirmedClaim - lastBatchedClaimNumber) >= MAX_NUMBER_OF_TRANSACTIONS) 
                ? lastBatchedClaimNumber + MAX_NUMBER_OF_TRANSACTIONS : lastConfirmedClaim;
            
            uint256 counterConfirmedTransactions;
            uint256 arraySize;

            //TODO: is there a better way?, need to know how big will the array be
            for (uint i = lastBatchedClaimNumber; i < lastClaimToInclude; i++) {
                ClaimTypes claimType = bccm.queuedClaimsTypes(_destinationChain, i);
                if(claimType == ClaimTypes.BRIDGING_REQUEST) {
                    arraySize++;
                }
            }

            ConfirmedTransaction[] memory confirmedTransactions = new ConfirmedTransaction[](arraySize);

            for (uint i = lastBatchedClaimNumber; i < lastClaimToInclude; i++) {
                ClaimTypes claimType = bccm.queuedClaimsTypes(_destinationChain, i);

                if(claimType == ClaimTypes.BRIDGING_REQUEST) {
                    Receiver[] memory tempReceivers = bccm.getClaimBRC(bccm.queuedClaims(_destinationChain, i)).receivers;
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
        UTXOs memory utxos = chainUTXOs[_destinationChain];
        uint256 sum = 0;
        uint256 counterForArraySize;

        //counter - other option would required using storage variable
        for (uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            if ((sum + utxos.multisigOwnedUTXOs[i].amount) >= txCost) {
                counterForArraySize++;
                break;
            } else {
                sum = utxos.multisigOwnedUTXOs[i].amount;
                counterForArraySize++;
            }
        }

        availableUTXOs.multisigOwnedUTXOs = new UTXO[](counterForArraySize);
        availableUTXOs.feePayerOwnedUTXOs = new UTXO[](1);

        for (uint i = 0; i < counterForArraySize; i++) {
                availableUTXOs.multisigOwnedUTXOs[i] = utxos.multisigOwnedUTXOs[i];
        }

        availableUTXOs.feePayerOwnedUTXOs[0] = utxos.feePayerOwnedUTXOs[0];

        return availableUTXOs;
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
        return confirmedBatches[_destinationChain];
    }

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (string memory blockHash) {
        return bccm.lastObserveredBlock(_sourceChain);
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function isChainRegistered(string calldata _chainId) external view override returns (bool) {
        return registeredChains[_chainId];
    }

    function getValidatorsCount() external view override returns (uint8) {
        return bccm.validatorsCount();
    }

    function getNumberOfVotes(string calldata _id) external view override returns (uint8) {
        return bccm.numberOfVotes(_id);
    }

    function getSignedBatches(string calldata _id) external view onlyValidator returns (SignedBatch[] memory) {
        return signedBatches[_id];
    }

    function getBridgeContractClaimsManager() external view onlyOwner returns (address) {
        return address(bccm);
    }

    function getAllPrivateKeyHashes() external view onlyOwner returns (bytes32[] memory) {
        bytes32[] memory _hashes = new bytes32[](validatorsAddresses.length);
        for (uint i = 0; i < validatorsAddresses.length; i++) {
            _hashes[i] = validatorsPrivateKeyHashes[validatorsAddresses[i]];
        }
        return _hashes;
    }

    function getchainUTXOs(string calldata _chainId) external view onlyOwner returns (UTXOs memory) {
        return chainUTXOs[_chainId];
    }

    function setPrivateKeyHash(bytes32 _hash) external onlyValidator {
        validatorsPrivateKeyHashes[msg.sender] = _hash;
        validatorsAddresses.push(msg.sender);
    }

    function setCurrentBatchBlock(string calldata _chainId, int256 _blockNumber) external onlyBridgeContractClaimsManager {
        currentBatchBlock[_chainId] = int(_blockNumber);
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyBridgeContractClaimsManager {
        nextTimeoutBlock[_chainId] = _blockNumber;
    }

    modifier onlyValidator() {
        if (!validators[msg.sender]) revert NotValidator();
        _;
    }

    modifier onlyOwner() {
       if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyBridgeContractClaimsManager() {
        if (msg.sender != address(bccm)) revert NotBridgeContractClaimsManagers();
        _;
    }
}