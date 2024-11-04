// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Bridge.sol";
import "./ClaimsHelper.sol";
import "./Validators.sol";

contract Claims is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    ClaimsHelper private claimsHelper;
    Validators private validators;

    address public defundAdmin;
    //chain -> address to defund to
    mapping(uint8 => string) public defundAddress;
    //keccak256)abi.encode(Packed"Defund")
    bytes32 private constant defundHash = 0xc74d0d70be942fd68984df57687b9f453f1321726e8db77762dee952a5c85b24;

    // BlockchainId -> bool
    mapping(uint8 => bool) public isChainRegistered;

    // BlochchainId -> blockNumber
    mapping(uint8 => uint256) public nextTimeoutBlock;

    uint16 public maxNumberOfTransactions;
    uint8 public timeoutBlocksNumber;

    // BlockchainId -> TokenQuantity
    mapping(uint8 => uint256) public chainTokenQuantity;

    // BlockchainId -> nonce -> ConfirmedTransaction
    mapping(uint8 => mapping(uint64 => ConfirmedTransaction)) public confirmedTransactions;

    // chainId -> nonce (nonce of the last confirmed transaction)
    mapping(uint8 => uint64) public lastConfirmedTxNonce;

    // chainId -> nonce (nonce of the last transaction from the executed batch)
    mapping(uint8 => uint64) public lastBatchedTxNonce;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        uint16 _maxNumberOfTransactions,
        uint8 _timeoutBlocksNumber
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        maxNumberOfTransactions = _maxNumberOfTransactions;
        timeoutBlocksNumber = _timeoutBlocksNumber;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(
        address _bridgeAddress,
        address _claimsHelperAddress,
        address _validatorsAddress
    ) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsHelper = ClaimsHelper(_claimsHelperAddress);
        validators = Validators(_validatorsAddress);
    }

    function submitClaims(ValidatorClaims calldata _claims, address _caller) external onlyBridge {
        uint256 bridgingRequestClaimsLength = _claims.bridgingRequestClaims.length;
        for (uint i; i < bridgingRequestClaimsLength; i++) {
            BridgingRequestClaim calldata _claim = _claims.bridgingRequestClaims[i];
            uint8 sourceChainId = _claim.sourceChainId;
            uint8 destinationChainId = _claim.destinationChainId;

            if (!isChainRegistered[sourceChainId]) {
                revert ChainIsNotRegistered(sourceChainId);
            }

            if (!isChainRegistered[destinationChainId]) {
                revert ChainIsNotRegistered(destinationChainId);
            }

            uint256 receiversSum = _claim.totalAmount;

            if (chainTokenQuantity[destinationChainId] < receiversSum) {
                emit NotEnoughFunds("BRC", i, chainTokenQuantity[destinationChainId]);
                continue;
            }

            _submitClaimsBRC(_claim, _caller, receiversSum);
        }

        uint256 batchExecutedClaimsLength = _claims.batchExecutedClaims.length;
        for (uint i; i < batchExecutedClaimsLength; i++) {
            BatchExecutedClaim calldata _claim = _claims.batchExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEC(_claim, _caller);
        }

        uint256 batchExecutionFailedClaimsLength = _claims.batchExecutionFailedClaims.length;
        for (uint i; i < batchExecutionFailedClaimsLength; i++) {
            BatchExecutionFailedClaim calldata _claim = _claims.batchExecutionFailedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsBEFC(_claim, _caller);
        }

        uint256 refundRequestClaimsLength = _claims.refundRequestClaims.length;
        for (uint i; i < refundRequestClaimsLength; i++) {
            RefundRequestClaim calldata _claim = _claims.refundRequestClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsRRC(_claim, _caller);
        }

        uint256 refundExecutedClaimsLength = _claims.refundExecutedClaims.length;
        for (uint i; i < refundExecutedClaimsLength; i++) {
            RefundExecutedClaim calldata _claim = _claims.refundExecutedClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimsREC(_claim, _caller);
        }

        uint256 hotWalletIncrementClaimsLength = _claims.hotWalletIncrementClaims.length;
        for (uint i; i < hotWalletIncrementClaimsLength; i++) {
            HotWalletIncrementClaim calldata _claim = _claims.hotWalletIncrementClaims[i];
            if (!isChainRegistered[_claim.chainId]) {
                revert ChainIsNotRegistered(_claim.chainId);
            }

            _submitClaimHWIC(_claim, _caller);
        }
    }

    function _submitClaimsBRC(BridgingRequestClaim calldata _claim, address _caller, uint256 receiversSum) internal {
        bytes32 claimHash = keccak256(abi.encode("BRC", _claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            uint8 destinationChainId = _claim.destinationChainId;

            chainTokenQuantity[destinationChainId] -= receiversSum;
            chainTokenQuantity[_claim.sourceChainId] += receiversSum;

            _setConfirmedTransactions(_claim);

            _updateNextTimeoutBlockIfNeeded(destinationChainId);
        }
    }

    function _submitClaimsBEC(BatchExecutedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("BEC", _claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;
        ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );
        uint64 _firstTxNounce = confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNounce = confirmedSignedBatch.lastTxNonceId;

        _emitBatchExecutionInfo(batchId, chainId, false, _firstTxNounce, _lastTxNounce);

        if (_quorumReached) {
            claimsHelper.resetCurrentBatchBlock(chainId);

            lastBatchedTxNonce[chainId] = confirmedSignedBatch.lastTxNonceId;
            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsBEFC(BatchExecutionFailedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("BEFC", _claim));
        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        uint8 chainId = _claim.chainId;
        uint64 batchId = _claim.batchNonceId;
        ConfirmedSignedBatchData memory confirmedSignedBatch = claimsHelper.getConfirmedSignedBatchData(
            chainId,
            batchId
        );
        uint64 _firstTxNounce = confirmedSignedBatch.firstTxNonceId;
        uint64 _lastTxNounce = confirmedSignedBatch.lastTxNonceId;

        _emitBatchExecutionInfo(batchId, chainId, true, _firstTxNounce, _lastTxNounce);

        if (_quorumReached) {
            claimsHelper.resetCurrentBatchBlock(chainId);

            for (uint64 i = _firstTxNounce; i <= _lastTxNounce; i++) {
                if (!(confirmedTransactions[chainId][i].observedTransactionHash == defundHash)) {
                    chainTokenQuantity[chainId] += confirmedTransactions[chainId][i].totalAmount;
                } else {
                    confirmedTransactions[chainId][++lastConfirmedTxNonce[chainId]] = confirmedTransactions[chainId][i];
                }
            }

            nextTimeoutBlock[chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function _submitClaimsRRC(RefundRequestClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("RRC", _claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _submitClaimsREC(RefundExecutedClaim calldata _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("REC", _claim));
        claimsHelper.setVotedOnlyIfNeeded(_caller, claimHash, validators.getQuorumNumberOfValidators());
    }

    function _submitClaimHWIC(HotWalletIncrementClaim memory _claim, address _caller) internal {
        bytes32 claimHash = keccak256(abi.encode("HWIC", _claim));

        bool _quorumReached = claimsHelper.setVotedOnlyIfNeeded(
            _caller,
            claimHash,
            validators.getQuorumNumberOfValidators()
        );

        if (_quorumReached) {
            uint8 chainId = _claim.chainId;
            uint256 changeAmount = _claim.amount;
            if (_claim.isIncrement) {
                chainTokenQuantity[chainId] += changeAmount;
            } else if (chainTokenQuantity[chainId] >= changeAmount) {
                chainTokenQuantity[chainId] -= changeAmount;
            } else {
                emit InsufficientFunds(chainId, changeAmount);
            }
        }
    }

    function _setConfirmedTransactions(BridgingRequestClaim memory _claim) internal {
        uint8 destinationChainId = _claim.destinationChainId;
        uint64 nextNonce = ++lastConfirmedTxNonce[destinationChainId];
        confirmedTransactions[destinationChainId][nextNonce].observedTransactionHash = _claim.observedTransactionHash;
        confirmedTransactions[destinationChainId][nextNonce].sourceChainId = _claim.sourceChainId;
        confirmedTransactions[destinationChainId][nextNonce].nonce = nextNonce;
        confirmedTransactions[destinationChainId][nextNonce].retryCounter = _claim.retryCounter;

        uint256 receiversLength = _claim.receivers.length;
        uint256 tokenQuantity;
        for (uint i; i < receiversLength; i++) {
            confirmedTransactions[destinationChainId][nextNonce].receivers.push(_claim.receivers[i]);
            tokenQuantity += _claim.receivers[i].amount;
        }

        confirmedTransactions[destinationChainId][nextNonce].totalAmount = tokenQuantity;

        confirmedTransactions[destinationChainId][nextNonce].blockHeight = block.number;
    }

    function _emitBatchExecutionInfo(
        uint64 _batchID,
        uint8 _chainId,
        bool _isFailedClaim,
        uint64 _firstTxNonce,
        uint64 _lastTxNounce
    ) private {
        TxDataInfo[] memory _txHashes = new TxDataInfo[](_lastTxNounce - _firstTxNonce + 1);
        for (uint64 i = _firstTxNonce; i <= _lastTxNounce; i++) {
            _txHashes[i - _firstTxNonce] = TxDataInfo(
                confirmedTransactions[_chainId][i].sourceChainId,
                confirmedTransactions[_chainId][i].observedTransactionHash
            );
        }

        emit BatchExecutionInfo(_batchID, _chainId, _isFailedClaim, _txHashes);
    }

    function setVoted(address _voter, bytes32 _hash) external onlyBridge returns (uint256) {
        return claimsHelper.setVoted(_voter, _hash);
    }

    function shouldCreateBatch(uint8 _destinationChain) public view returns (bool) {
        // if not registered chain or batch is already created, return false
        if (!isChainRegistered[_destinationChain] || claimsHelper.currentBatchBlock(_destinationChain) != int(-1)) {
            return false;
        }

        uint256 cnt = getBatchingTxsCount(_destinationChain);

        return cnt >= maxNumberOfTransactions || (cnt > 0 && block.number >= nextTimeoutBlock[_destinationChain]);
    }

    function getConfirmedTransaction(
        uint8 _destinationChain,
        uint64 _nonce
    ) public view returns (ConfirmedTransaction memory _confirmedTransaction) {
        return confirmedTransactions[_destinationChain][_nonce];
    }

    function getBatchingTxsCount(uint8 _chainId) public view returns (uint64 counterConfirmedTransactions) {
        uint64 lastConfirmedTxNonceForChain = lastConfirmedTxNonce[_chainId];
        uint64 lastBatchedTxNonceForChain = lastBatchedTxNonce[_chainId];

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

    function resetCurrentBatchBlock(uint8 _chainId) external onlyBridge {
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function setChainRegistered(uint8 _chainId, uint256 _initialTokenSupply) external onlyBridge {
        isChainRegistered[_chainId] = true;
        chainTokenQuantity[_chainId] = _initialTokenSupply;
        nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        claimsHelper.resetCurrentBatchBlock(_chainId);
    }

    function setNextTimeoutBlock(uint8 _chainId, uint256 _blockNumber) external onlyBridge {
        nextTimeoutBlock[_chainId] = _blockNumber + timeoutBlocksNumber;
    }

    function hasVoted(bytes32 _hash, address _voter) external view returns (bool) {
        return claimsHelper.hasVoted(_hash, _voter);
    }

    function defund(uint8 _chainId, uint256 _amount) external onlyDefundAdmin {
        if (!isChainRegistered[_chainId]) {
            revert ChainIsNotRegistered(_chainId);
        }
        if (chainTokenQuantity[_chainId] < _amount) {
            revert DefundRequestTooHigh(_chainId, chainTokenQuantity[_chainId], _amount);
        }

        BridgingRequestClaim memory _brc = BridgingRequestClaim({
            observedTransactionHash: defundHash,
            receivers: new Receiver[](1),
            totalAmount: _amount,
            retryCounter: 0,
            sourceChainId: _chainId,
            destinationChainId: _chainId
        });

        _brc.receivers[0].amount = _amount;
        _brc.receivers[0].destinationAddress = defundAddress[_chainId];

        chainTokenQuantity[_chainId] -= _amount;

        _setConfirmedTransactions(_brc);

        _updateNextTimeoutBlockIfNeeded(_chainId);

        emit ChainDefunded(_chainId, _amount);
    }

    function _updateNextTimeoutBlockIfNeeded(uint8 _chainId) internal {
        uint256 _confirmedTxCount = getBatchingTxsCount(_chainId);

        if (
            (claimsHelper.currentBatchBlock(_chainId) == -1) && // there is no batch in progress
            (_confirmedTxCount == 0) && // check if there is no other confirmed transactions
            (block.number >= nextTimeoutBlock[_chainId])
        ) // check if the current block number is greater or equal than the NEXT_BATCH_TIMEOUT_BLOCK
        {
            nextTimeoutBlock[_chainId] = block.number + timeoutBlocksNumber;
        }
    }

    function getTokenQuantity(uint8 _chainId) external view returns (uint256) {
        return chainTokenQuantity[_chainId];
    }

    function setDefundOwner(address _defundAdmin) external onlyOwner {
        defundAdmin = _defundAdmin;
    }

    function setDefundAddress(uint8 _chainId, string calldata _address) external onlyDefundAdmin {
        defundAddress[_chainId] = _address;
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyDefundAdmin() {
        if (msg.sender != defundAdmin) revert NotDefundAdmin();
        _;
    }
}
