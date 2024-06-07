// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./ClaimsHelper.sol";
import "./UTXOsc.sol";
import "./Validators.sol";

contract Claims is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    UTXOsc private utxosc;
    Validators private validators;

    // BlockchainID -> bool
    mapping(string => bool) public isChainRegistered;

    // Blochchain ID -> blockNumber
    mapping(string => uint256) public nextTimeoutBlock;

    uint16 public maxNumberOfTransactions;
    uint8 public timeoutBlocksNumber;

    // BlockchainId -> TokenQuantity
    mapping(string => uint256) public chainTokenQuantity;

    // BlockchainID -> nonce -> ConfirmedTransaction
    mapping(string => mapping(uint256 => ConfirmedTransaction)) private confirmedTransactions;

    // chainID -> nonce (nonce of the last confirmed transaction)
    mapping(string => uint256) public lastConfirmedTxNonce;

    // chainID -> nonce (nonce of the last transaction from the executed batch)
    mapping(string => uint256) public lastBatchedTxNonce;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint16 _maxNumberOfTransactions, uint8 _timeoutBlocksNumber) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _utxosc,
        address _validatorsAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        utxosc = UTXOsc(_utxosc);
        validators = Validators(_validatorsAddress);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
        for (uint i; i < bridgingRequestClaimsLength; i++) {
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            string calldata sourceChainID = _claim.sourceChainID;
            string calldata destinationChainID = _claim.destinationChainID;

            if (!isChainRegistered[sourceChainID]) {
                revert ChainIsNotRegistered(sourceChainID);
            }

            if (!isChainRegistered[destinationChainID]) {
                revert ChainIsNotRegistered(destinationChainID);
            }

            if (chainTokenQuantity[sourceChainID] < getNeededTokenQuantity(_claim.receivers)) {
                continue;
            }

            _submitClaimsBRC(_claim, _caller);
        }

        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            _submitClaimsBEC(_claim, _caller);
        }

        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            _submitClaimsBEFC(_claim, _caller);
        }

        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            _submitClaimsRRC(_claim, _caller);
        }

        uint256 refundExecutedClaimsLength = _claims.refundExecutedClaims.length;
        for (uint i; i < refundExecutedClaimsLength; i++) {
            RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainID]) {
                revert ChainIsNotRegistered(_claim.chainID);
            }

            _submitClaimsREC(_claim, _caller);
        }
    }

    function _submitClaimsBRC(BridgingRequestClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode(_claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            string calldata destinationChainID = _claim.destinationChainID;
            chainTokenQuantity[_claim.sourceChainID] -= getNeededTokenQuantity(_claim.receivers);

            utxosc.addNewBridgingUTXO(_claim.sourceChainID, _claim.outputUTXO);

            uint256 confirmedTxCount = getBatchingTxsCount(destinationChainID);

            _setConfirmedTransactions(_claim);

            if (
                (claimsHelper.currentBatchBlock(destinationChainID) == -1) && // there is no batch in progress
                (confirmedTxCount == 0) && // check if there is no other confirmed transactions
                (block.number >= nextTimeoutBlock[destinationChainID])
            ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
            {
                nextTimeoutBlock[destinationChainID] = block.number + timeoutBlocksNumber;
            }
        }
    }

    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode(_claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            string calldata chainID = _claim.chainID;

            claimsHelper.resetCurrentBatchBlock(chainID);

            ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
                chainID,
                _claim.batchNonceID
            );
            uint256 _firstTxNounce = confirmedSignedBatch.firstTxNonceId;
            uint256 _lastTxNounce = confirmedSignedBatch.lastTxNonceId;

            for (uint i = _firstTxNounce; i <= _lastTxNounce; i++) {
                chainTokenQuantity[chainID] += getNeededTokenQuantity(confirmedTransactions[chainID][i].receivers);
            }
        
            lastBatchedTxNonce[chainID] = confirmedSignedBatch.lastTxNonceId;

            nextTimeoutBlock[chainID] = block.number + timeoutBlocksNumber;

            utxosc.addUTXOs(chainID, _claim.outputUTXOs);
            utxosc.removeUsedUTXOs(chainID, confirmedSignedBatch.usedUTXOs);
        }
    }

    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode(_claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            string calldata chainID = _claim.chainID;
            claimsHelper.resetCurrentBatchBlock(chainID);

            nextTimeoutBlock[chainID] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(RefundRequestClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode(_claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _submitClaimsREC(RefundExecutedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode(_claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _setConfirmedTransactions(BridgingRequestClaim calldata _claim) internal {
        string calldata destinationChainID = _claim.destinationChainID;
        uint256 nextNonce = ++lastConfirmedTxNonce[destinationChainID];
        confirmedTransactions[destinationChainID][nextNonce].observedTransactionHash = _claim.observedTransactionHash;
        confirmedTransactions[destinationChainID][nextNonce].sourceChainID = _claim.sourceChainID;
        confirmedTransactions[destinationChainID][nextNonce].nonce = nextNonce;

        uint256 receiversLength = _claim.receivers.length;
        for (uint i; i < receiversLength; i++) {
            confirmedTransactions[destinationChainID][nextNonce].receivers.push(_claim.receivers[i]);
        }

        confirmedTransactions[destinationChainID][nextNonce].blockHeight = block.number;
    }

    function setVoted(address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_voter, _hash);
    }

    function shouldCreateBatch(string calldata _destinationChain) public view returns (bool) {
        // if batch is already created, return false
        if (claimsHelper.currentBatchBlock(_destinationChain) != int(-1)) {
            return false;
        }

        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function setTokenQuantity(string calldata _chainID, uint256 _tokenQuantity) external onlyBridge {
        chainTokenQuantity[_chainID] = _tokenQuantity;
    }

    function getConfirmedTransaction(
        string calldata _destinationChain,
        uint256 _nonce
    ) public view returns (ConfirmedTransaction memory) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getBatchingTxsCount(string calldata _chainId) public view returns (uint256 counterConfirmedTransactions) {
        uint256 lastConfirmedTxNonceForChain = lastConfirmedTxNonce[_chainId];
        uint256 lastBatchedTxNonceForChain = lastBatchedTxNonce[_chainId];

        uint256 txsToProcess = ((lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain) >= maxNumberOfTransactions)
            ? maxNumberOfTransactions
            : (lastConfirmedTxNonceForChain - lastBatchedTxNonceForChain);

        counterConfirmedTransactions = 0;

        while (counterConfirmedTransactions < txsToProcess) {
            uint256 blockHeight = confirmedTransactions[_chainId][
                lastBatchedTxNonceForChain + counterConfirmedTransactions + 1
            ].blockHeight;
            if (blockHeight >= nextTimeoutBlock[_chainId]) {
                break;
            }
            counterConfirmedTransactions++;
        }
    }

    function resetCurrentBatchBlock(string calldata _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function getNeededTokenQuantity(Receiver[] memory _receivers) internal pure returns (uint256) {
        uint256 tokenQuantity;

        uint256 receiversLength = _receivers.length;
        for (uint256 i = 0; i < receiversLength; i++) {
            tokenQuantity += _receivers[i].amount;
        }

        return tokenQuantity;
    }

    function setChainRegistered(string calldata _chainId) external onlyBridge {
        isChainRegistered[_chainId] = true;
    }

    function setNextTimeoutBlock(string calldata _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    function hasVoted(bytes32 _hash, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_hash, _voter);
    }

    function getTokensQuantity(string calldata _chainId) view external returns (uint256) {
        return chainTokenQuantity[_chainId];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
