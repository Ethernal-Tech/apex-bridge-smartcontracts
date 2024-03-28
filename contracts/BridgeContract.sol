// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContract.sol";
import "./ClaimsHelper.sol";
import "./SlotsManager.sol";
import "./ClaimsManager.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract BridgeContract is IBridgeContract {
    ClaimsHelper private claimsHelper;
    ClaimsManager private claimsManager;
    UTXOsManager private utxosManager;
    SignedBatchManager private signedBatchManager;
    SlotsManager private slotsManager;

    // mapping in case they could be added/removed
    mapping(address => bool) private isValidator;

    mapping(string => bool) private registeredChains;

    // Blochchain ID -> claimsCounter
    mapping(string => uint256) public lastBatchedClaim;

    // Blockchain ID -> claimNumber
    mapping(string => uint256) public lastClaimIncludedInBatch;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;


    Chain[] private chains;
    address[] private validatorsAddresses;

    address private owner;
    //TODO: set during initialization
    uint16 public constant MAX_NUMBER_OF_TRANSACTIONS = 1; //intentially set low for testing
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
        signedBatchManager.submitSignedBatch(_signedBatch, msg.sender);
    }

    // Slots 
    function submitLastObservableBlocks(string calldata chainID, CardanoBlock[] calldata blocks) external override onlyValidator {
        slotsManager.updateBlocks(chainID, blocks, msg.sender);
    }
    
    // Chain registration by Owner
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        string calldata _keyHashMultisig,
        string calldata _keyHashFeePayer,
        uint256 _tokenQuantity
    ) public override onlyOwner {
        _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _keyHashMultisig, _keyHashFeePayer, _tokenQuantity);
    }

    function registerChainGovernance(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        string calldata _keyHashMultisig,
        string calldata _keyHashFeePayer,
        uint256 _tokenQuantity
    ) external onlyValidator {
        if (registeredChains[_chainId]) {
            revert ChainAlreadyRegistered(_chainId);
        }
        if (claimsManager.voted(_chainId, msg.sender)) {
            revert AlreadyProposed(_chainId);
        }

        ChainWithoutSignatures memory _chain = ChainWithoutSignatures(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _tokenQuantity);
        bytes32 chainHash = keccak256(abi.encode(_chain));
        
        claimsManager.setVoted(_chainId, msg.sender, true);
        claimsManager.setNumberOfVotes(chainHash);
        
        if (claimsHelper.hasChainRegistrationConsensus(chainHash)) {
            _registerChain(_chainId, _initialUTXOs, _addressMultisig, _addressFeePayer, _keyHashMultisig, _keyHashFeePayer, _tokenQuantity);
        } else {
            emit newChainProposal(_chainId, msg.sender);
        }
    }

    function _registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer,
        string calldata _keyHashMultisig,
        string calldata _keyHashFeePayer,
        uint256 _tokenQuantity
    ) internal {
        registeredChains[_chainId] = true;
        chains.push();
        chains[chains.length - 1].id = _chainId;
        chains[chains.length - 1].utxos = _initialUTXOs;
        chains[chains.length - 1].addressMultisig = _addressMultisig;
        chains[chains.length - 1].addressFeePayer = _addressFeePayer;
        chains[chains.length - 1].keyHashMultisig = _keyHashMultisig;
        chains[chains.length - 1].keyHashFeePayer = _keyHashFeePayer;
        chains[chains.length - 1].tokenQuantity = _tokenQuantity;

        utxosManager.pushUTXOs(_chainId, _initialUTXOs);

        claimsManager.setTokenQuantity(_chainId, _tokenQuantity);

        signedBatchManager.setCurrentBatchBlock(_chainId, int(-1));

        nextTimeoutBlock[_chainId] = block.number + MAX_NUMBER_OF_BLOCKS;

        emit newChainRegistered(_chainId);
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // TODO:
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(string calldata _destinationChain) public view override returns (bool batch) {
        return signedBatchManager.shouldCreateBatch(_destinationChain);
    }

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    ) external view override returns (ConfirmedTransaction[] memory _confirmedTransactions) {
        if (!shouldCreateBatch(_destinationChain)) {
            revert CanNotCreateBatchYet(_destinationChain);
        }

        uint256[] memory _nonces = claimsManager.getConfirmedTxNonces(_destinationChain);
        uint256 counterConfirmedTransactions = 0;
        uint i = 0;

        _confirmedTransactions = new ConfirmedTransaction[](_nonces.length);

        while (counterConfirmedTransactions < MAX_NUMBER_OF_TRANSACTIONS) {
            ConfirmedTransaction memory confirmedTx = claimsManager.getConfirmedTransaction(_nonces[i]);
            if (confirmedTx.blockHeight >= nextTimeoutBlock[_destinationChain]){
                break;
            }
            _confirmedTransactions[counterConfirmedTransactions] = confirmedTx;
            counterConfirmedTransactions++;
            i++;
        }

        return _confirmedTransactions;

        // uint256 lastBatchedClaimNumber = lastBatchedClaim[_destinationChain];
        // uint256 lastConfirmedClaim = claimsManager.claimsCounter(_destinationChain);

        // uint256 lastClaimToInclude = ((lastConfirmedClaim - lastBatchedClaimNumber) >= MAX_NUMBER_OF_TRANSACTIONS)
        //     ? lastBatchedClaimNumber + MAX_NUMBER_OF_TRANSACTIONS
        //     : lastConfirmedClaim;

        // lastClaimIncludedInBatch[_destinationChain] = lastClaimToInclude;

        // uint256 counterConfirmedTransactions;

        // ConfirmedTransaction[] memory confirmedTransactions = new ConfirmedTransaction[](
        //     lastClaimToInclude - lastBatchedClaimNumber
        // );

        // for (uint i = lastBatchedClaimNumber + 1; i <= lastClaimToInclude; i++) {
        //     ClaimTypes claimType = claimsManager.queuedClaimsTypes(_destinationChain, i);

        //     if (claimType == ClaimTypes.BRIDGING_REQUEST) {
        //         Receiver[] memory tempReceivers = claimsHelper
        //             .getClaimBRC(claimsManager.queuedClaims(_destinationChain, i))
        //             .receivers;

        //         ConfirmedTransaction memory confirmedtransaction = ConfirmedTransaction(
        //             // function can not be view anymore
        //             confirmedTransactionNounce[_destinationChain]++,
        //             tempReceivers
        //         );
        //         confirmedTransactions[counterConfirmedTransactions] = confirmedtransaction;
        //         counterConfirmedTransactions++;
        //     } else {
        //         revert RefundRequestClaimNotYetSupporter();
        //     }
        //     i++;
        // }
        // return confirmedTransactions;
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
    ) external view override returns (UTXOs memory availableUTXOs) {
        return utxosManager.getAvailableUTXOs(_destinationChain, txCost);
    }

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {
        //return confirmedBatches[_destinationChain][lastConfirmedBatch[_destinationChain]];
        return signedBatchManager.getConfirmedBatch(_destinationChain);
    }

    function getLastObservedBlock(string calldata _sourceChain) external view override returns (CardanoBlock memory cblock) {
        return slotsManager.getLastObservedBlock(_sourceChain);
    }

    function getAllRegisteredChains() external view override returns (Chain[] memory _chains) {
        return chains;
    }

    function isChainRegistered(string calldata _chainId) external view override returns (bool) {
        return registeredChains[_chainId];
    }

    function getQuorumNumberOfValidators() external view override returns (uint8) {
        // return (validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1); is same as (A + B - 1) / B
        return (validatorsCount * 2 + 2) / 3;
    }

    function getNumberOfVotes(bytes32 _hash) external view override returns (uint8) {
        return claimsManager.numberOfVotes(_hash);
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external /*onlyClaimsManager*/ {
        nextTimeoutBlock[_chainId] = _blockNumber;
    }

    function setLastBatchedClaim(string calldata _chainId) public onlyClaimsManager {
        lastBatchedClaim[_chainId] = lastClaimIncludedInBatch[_chainId];
    }

    function setClaimsHelper(address _claimsHelper) external onlyOwner {
        claimsHelper = ClaimsHelper(_claimsHelper);
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

    function setSlotsManager(SlotsManager _slotsManager) external onlyOwner() {
        slotsManager = SlotsManager(_slotsManager);
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

    modifier onlyClaimsHelper() {
        if (msg.sender != address(claimsHelper)) revert NotClaimsHelper();
        _;
    }
}
