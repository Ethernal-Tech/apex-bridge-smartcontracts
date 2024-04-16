// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ClaimsHelper.sol";
import "./ValidatorsContract.sol";
import "./SignedBatchManager.sol";
import "./UTXOsManager.sol";
import "hardhat/console.sol";

contract ClaimsManager is IBridgeContractStructs {
    address private bridgeContractAddress;
    ClaimsHelper private claimsHelper;
    address private signedBatchManagerAddress;
    UTXOsManager private utxosManager;
    ValidatorsContract private validatorsContract;
    address private owner;

    // BlockchainID -> bool
    mapping(string => bool) public isChainRegistered;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    uint16 public maxNumberOfTransactions;
    uint8 private timeoutBlocksNumber;

    // TansactionHash -> Voter -> Voted
    mapping(string => mapping(address => bool)) public voted;

    // ClaimHash -> numberOfVotes
    mapping(bytes32 => uint8) public numberOfVotes;

    // BlockchainId -> TokenQuantity
    mapping(string => uint256) public chainTokenQuantity;

    // BlockchainID -> nonce -> ConfirmedTransaction
    mapping(string => mapping(uint256 => ConfirmedTransaction)) private confirmedTransactions;

    // chainID -> nonce (nonce of the last confirmed transaction)
    mapping(string => uint256) public lastConfirmedTxNonce;

    // chainID -> nonce (nonce of the last transaction from the executed batch)
    mapping(string => uint256) public lastBatchedTxNonce;

    // Blochchain ID -> blockNumber
    mapping(string => int256) public currentBatchBlock;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(
        address _bridgeContractAddress,
        address _claimsHelperAddress,
        address _signedBatchManagerAddress,
        address _utxosManager,
        address _validatorsContractAddress,
        uint16 _maxNumberOfTransactions,
        uint8 _timeoutBlocksNumber
    ) external onlyOwner {
        bridgeContractAddress = _bridgeContractAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        signedBatchManagerAddress = _signedBatchManagerAddress;
        utxosManager = UTXOsManager(_utxosManager);
        validatorsContract = ValidatorsContract(_validatorsContractAddress);
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridgeContract {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[i];
            if (!isChainRegistered[_claim.sourceChainID]) {
                revert ChainIsNotRegistered(_claim.sourceChainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            if (chainTokenQuantity[_claim.sourceChainID] < getNeededTokenQuantity(_claim.receivers)) {
                revert NotEnoughBridgingTokensAwailable(_claim.observedTransactionHash);
            }

            _submitClaimsBRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutedClaims.length; i++) {
            BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.batchExecutionFailedClaims.length; i++) {
            BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsBEFC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundRequestClaims.length; i++) {
            RefundRequestClaim memory _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsRRC(_claims, i, _caller);
        }
        for (uint i = 0; i < _claims.refundExecutedClaims.length; i++) {
            RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            if (voted[_claim.observedTransactionHash][_caller]) {
                revert AlreadyProposed(_claim.observedTransactionHash);
            }

            if (claimsHelper.isClaimConfirmed(_claim.chainID, _claim.observedTransactionHash)) {
                revert AlreadyConfirmed(_claim.observedTransactionHash);
            }

            _submitClaimsREC(_claims, i, _caller);
        }
    }

    function _submitClaimsBRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BridgingRequestClaim memory _claim = _claims.bridgingRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            chainTokenQuantity[_claim.sourceChainID] -= getNeededTokenQuantity(_claim.receivers);

            utxosManager.addNewBridgingUTXO(_claim.sourceChainID, _claim.outputUTXO);

            _setConfirmedTransactions(_claim);

            claimsHelper.setClaimConfirmed(_claim.destinationChainID, _claim.observedTransactionHash);

            uint256 confirmedTxCount = getBatchingTxsCount(_claim.destinationChainID);
            if (
                (currentBatchBlock[_claim.destinationChainID] != -1) && // check if there is no batch in progress
                (confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number > nextTimeoutBlock[_claim.destinationChainID])
            ) // check if the current block number is greater than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[_claim.destinationChainID] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimsBEC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutedClaim memory _claim = _claims.batchExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            chainTokenQuantity[_claim.chainID] += getTokenAmountFromSignedBatch(_claim.chainID, _claim.batchNonceID);

            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            currentBatchBlock[_claim.chainID] = int(-1);

            SignedBatch memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatch(
                _claim.chainID,
                _claim.batchNonceID
            );
            uint256 txLength = confirmedSignedBatch.includedTransactions.length;
            if (txLength > 0) {
                lastBatchedTxNonce[_claim.chainID] = confirmedSignedBatch.includedTransactions[txLength - 1];
            }

            nextTimeoutBlock[_claim.chainID] = block.number + timeoutBlocksNumber;

            utxosManager.addUTXOs(_claim.chainID, _claim.outputUTXOs);
            utxosManager.removeUsedUTXOs(_claim.chainID, confirmedSignedBatch.usedUTXOs);
        }
    }

    function _submitClaimsBEFC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        BatchExecutionFailedClaim memory _claim = _claims.batchExecutionFailedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);

            currentBatchBlock[_claim.chainID] = int(-1);

            nextTimeoutBlock[_claim.chainID] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundRequestClaim memory _claim = _claims.refundRequestClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _submitClaimsREC(ValidatorClaims calldata _claims, uint256 index, address _caller) internal {
        RefundExecutedClaim memory _claim = _claims.refundExecutedClaims[index];
        voted[_claim.observedTransactionHash][_caller] = true;
        bytes32 claimHash = keccak256(abi.encode(_claim));
        numberOfVotes[claimHash]++;

        if (hasConsensus(claimHash)) {
            claimsHelper.setClaimConfirmed(_claim.chainID, _claim.observedTransactionHash);
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim) internal {
        // passed the claim with the memory keyword
        uint256 nextNonce = ++lastConfirmedTxNonce[_claim.destinationChainID];
        confirmedTransactions[_claim.destinationChainID][nextNonce].observedTransactionHash = _claim
            .observedTransactionHash;
        confirmedTransactions[_claim.destinationChainID][nextNonce].sourceChainID = _claim.sourceChainID;
        confirmedTransactions[_claim.destinationChainID][nextNonce].nonce = nextNonce;

        for (uint i = 0; i < _claim.receivers.length; i++) {
            confirmedTransactions[_claim.destinationChainID][nextNonce].receivers.push(_claim.receivers[i]);
        }

        confirmedTransactions[_claim.destinationChainID][nextNonce].blockHeight = block.number;
    }

    function isBatchCreated(string calldata _destinationChain) public view returns (bool batch) {
        return currentBatchBlock[_destinationChain] != int(-1);
    }

    function shouldCreateBatch(string calldata _destinationChain) public view returns (bool) {
        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function setVoted(
        string calldata _id,
        address _voter,
        bool _value
    ) external onlySignedBatchManagerOrBridgeContract {
        voted[_id][_voter] = _value;
    }

    function setNumberOfVotes(bytes32 _hash) external onlySignedBatchManagerOrBridgeContract {
        numberOfVotes[_hash]++;
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridgeContract {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    function getConfirmedTransaction(
        string memory _destinationChain,
        uint256 _nonce
    ) public view returns (ConfirmedTransaction memory) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getBatchingTxsCount(string memory _chainId) public view returns (uint256 counterConfirmedTransactions) {
        uint256 lastConfirmedTxNonceForChain = lastConfirmedTxNonce[_chainId];
        uint256 lastBatchedTxNonceForChain = lastBatchedTxNonce[_chainId];

        uint256 txsToProcess = ((lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain) >= maxNumberOfTransactions)
            ? maxNumberOfTransactions
            : (lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain);

        counterConfirmedTransactions = 0;

        while (counterConfirmedTransactions < txsToProcess) {
            ConfirmedTransaction memory confirmedTx = getConfirmedTransaction(
                _chainId,
                lastBatchedTxNonceForChain + counterConfirmedTransactions + 1
            );
            if (confirmedTx.blockHeight >= nextTimeoutBlock[_chainId]) {
                break;
            }
            counterConfirmedTransactions++;
        }
    }

    function getTokenAmountFromSignedBatch(
        string memory _destinationChain,
        uint256 _nonce
    ) public view returns (uint256) {
        uint256 bridgedAmount;

        uint256[] memory _nonces = claimsHelper.getConfirmedSignedBatch(_destinationChain, _nonce).includedTransactions;

        for (uint i = 0; i < _nonces.length; i++) {
            bridgedAmount += getNeededTokenQuantity(confirmedTransactions[_destinationChain][_nonces[i]].receivers);
        }

        return bridgedAmount;
    }

    function setCurrentBatchBlock(string calldata _chainId, int value) external onlySignedBatchManager {
        currentBatchBlock[_chainId] = value;
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyBridgeContract {
        currentBatchBlock[_chainId] = int(-1);
    }

    function hasConsensus(bytes32 _hash) public view returns (bool) {
        return numberOfVotes[_hash] >= validatorsContract.getQuorumNumberOfValidators();
    }

    function getNeededTokenQuantity(Receiver[] memory _receivers) internal pure returns (uint256) {
        uint256 tokenQuantity;

        for (uint256 i = 0; i < _receivers.length; i++) {
            tokenQuantity += _receivers[i].amount;
        }

        return tokenQuantity;
    }

    function setChainRegistered(string calldata _chainId) external onlyBridgeContract {
        isChainRegistered[_chainId] = true;
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyBridgeContract {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    modifier onlyOwner() {
        if (msg.sender != address(owner)) revert NotOwner();
        _;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }

    modifier onlySignedBatchManager() {
        if (msg.sender != signedBatchManagerAddress) revert NotSignedBatchManager();
        _;
    }

    modifier onlySignedBatchManagerOrBridgeContract() {
        if (msg.sender != signedBatchManagerAddress && msg.sender != bridgeContractAddress)
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
