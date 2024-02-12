// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";
import "hardhat/console.sol";

contract BridgeContract is IBridgeContract {
    mapping(address => bool) private validators; // mapping in case they could be added/removed
    mapping(string => bool) private registeredChains;

    mapping(string => address[]) private voters;
    mapping(string => uint8) private numberOfVotes;

    mapping(string => BridgingRequestClaim) public queuedBridgingRequestsClaims;
    mapping(string => BridgingRequestClaim) private queuedBatchExecutedClaim;
    mapping(string => BridgingRequestClaim) private queuedBatchExecutionFailedClaim;
    mapping(string => BridgingRequestClaim) private queuedRefundRequestClaim;
    mapping(string => BridgingRequestClaim) private queuedRefundExecutedClaim;

    // claim_type, chain, hash -> claim_object is missing because we do not have claim struct
    // by implementing "universal" claim struct we could have "universal" mapping
    // and would not need to have separate mapping for each claim type
    // map[claim_type]map[chain]map[hash]claim_object
    mapping(ClaimTypes => mapping(string => string[])) private queuedClaims;

    Chain[] private chains;
    uint8 private validatorsCount;

    constructor(address[] memory _validators) {
        for (uint i = 0; i < _validators.length; i++) {
            validators[_validators[i]] = true;
        }
        validatorsCount = uint8(_validators.length);
    }

    // Claims
    function submitClaims(
        ValidatorClaims calldata _claims
    ) external override onlyValidator {
        for (uint i = 0; i < _claims.bridgingRequestClaims.length; i++) {
            require(!_isQueued(_claims.bridgingRequestClaims[i]), "Already queued");
            require(
                !_hasVoted(
                    _claims.bridgingRequestClaims[i].observedTransactionHash
                ),
                "Already proposed"
            );
            _submitClaims(_claims, i);
        }
    }

    // // Batches
    function submitSignedBatch(
        SignedBatch calldata _signedBatch
    ) external override onlyValidator {}

    // Chain registration through some kind of governance
    function registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) external override onlyValidator {
        require(!registeredChains[_chainId], "Chain already registered");
        require(!_hasVoted(_chainId), "Already proposed");
        _registerChain(
            _chainId,
            _initialUTXOs,
            _addressMultisig,
            _addressFeePayer
        );
    }

    function _registerChain(
        string calldata _chainId,
        UTXOs calldata _initialUTXOs,
        string calldata _addressMultisig,
        string calldata _addressFeePayer
    ) internal {
        voters[_chainId].push(msg.sender);
        numberOfVotes[_chainId]++;
        if (_hasConsensus(_chainId)) {
            registeredChains[_chainId] = true;
            chains.push();
            chains[chains.length - 1].id = _chainId;
            chains[chains.length - 1].utxos = _initialUTXOs;
            chains[chains.length - 1].addressMultisig = _addressMultisig;
            chains[chains.length - 1].addressFeePayer = _addressFeePayer;
            emit newChainRegistered(_chainId);
        }
        emit newChainProposal(_chainId, msg.sender);
    }

    function _submitClaims(
        ValidatorClaims calldata _claims,
        uint256 index
    ) internal {
        console.log("USAO U _submitClaims");
        voters[_claims.bridgingRequestClaims[index].observedTransactionHash]
            .push(msg.sender);
        numberOfVotes[
            _claims.bridgingRequestClaims[index].observedTransactionHash
        ]++;
        console.log("Broj glasova: ", numberOfVotes[_claims.bridgingRequestClaims[index].observedTransactionHash]);
        if (
            _hasConsensus(
                _claims.bridgingRequestClaims[index].observedTransactionHash
            )
        ) {
            console.log("STIGAO DO CONSENSUSA");
            queuedBridgingRequestsClaims[
                _claims.bridgingRequestClaims[index].observedTransactionHash
            ] = _claims.bridgingRequestClaims[index];

            console.log("STA SAM SACUVAO 1: ", queuedBridgingRequestsClaims[_claims.bridgingRequestClaims[index].observedTransactionHash].observedTransactionHash);

            queuedClaims[ClaimTypes.BRIDGING_REQUEST][
                _claims.bridgingRequestClaims[index].sourceChainID
            ].push(
                    _claims.bridgingRequestClaims[index].observedTransactionHash
                );

            console.log("STA SAM SACUVAO 2: ", queuedClaims[ClaimTypes.BRIDGING_REQUEST][
                _claims.bridgingRequestClaims[index].sourceChainID][0]);
        }
    }

    // Queries

    // Will determine if enough transactions are confirmed, or the timeout between two batches is exceeded.
    // It will also check if the given validator already submitted a signed batch and return the response accordingly.
    function shouldCreateBatch(
        string calldata _destinationChain
    ) external view override returns (bool batch) {}

    // Will return confirmed transactions until NEXT_BATCH_TIMEOUT_BLOCK or maximum number of transactions that
    // can be included in the batch, if the maximum number of transactions in a batch has been exceeded
    function getConfirmedTransactions(
        string calldata _destinationChain
    )
        external
        view
        override
        returns (ConfirmedTransaction[] memory confirmedTransactions)
    {}

    // Will return available UTXOs that can cover the cost of bridging transactions included in some batch.
    // Each Batcher will first call the GetConfirmedTransactions() and then calculate (off-chain) how many tokens
    // should be transfered to users and send this info through the 'txCost' parameter. Based on this input and
    // number of UTXOs that need to be consolidated, the smart contract will return UTXOs belonging to the multisig address
    // that can cover the expenses. Additionaly, this method will return available UTXOs belonging to fee payer
    // multisig address that will cover the network fees (see chapter "2.2.2.3 Batcher" for more details)
    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external view override returns (UTXOs memory availableUTXOs) {}

    function getConfirmedBatch(
        string calldata _destinationChain
    ) external view override returns (ConfirmedBatch memory batch) {}

    function getLastObservedBlock(
        string calldata _sourceChain
    ) external view override returns (string memory blockHash) {}

    function getAllRegisteredChains()
        external
        view
        override
        returns (Chain[] memory _chains)
    {
        return chains;
    }

    function isChainRegistered(
        string calldata _chainId
    ) external view override returns (bool) {
        return registeredChains[_chainId];
    }

    function getValidatorsCount() external view override returns (uint8) {
        return validatorsCount;
    }

    //could be renamed to work with all voting types
    function getNumberOfVotes(
        string calldata _id
    ) external view override returns (uint8) {
        return numberOfVotes[_id];
    }

    function _hasVoted(string calldata _id) internal view returns (bool) {
        for (uint i = 0; i < voters[_id].length; i++) {
            if (voters[_id][i] == msg.sender) {
                return true;
            }
        }
        return false;
    }

    function isQueued(BridgingRequestClaim calldata _claim) external view returns (bool) {
         return _isQueued(_claim);
    }

    function _isQueued(BridgingRequestClaim calldata _claim) internal view returns (bool) {
        console.log("PRVI", _claim.observedTransactionHash);
        console.log("DRUGI", queuedBatchExecutedClaim[_claim.observedTransactionHash].observedTransactionHash);
         return keccak256(abi.encode(_claim)) == keccak256(abi.encode(queuedBatchExecutedClaim[_claim.observedTransactionHash]));
    }

    function _hasConsensus(string calldata _id) internal view returns (bool) {
        console.log("USAO u _hasConsensus");
        if (
            numberOfVotes[_id] >=
            ((validatorsCount * 2) /
                3 +
                ((validatorsCount * 2) % 3 == 0 ? 0 : 1))
        ) {
            return true;
        }
        return false;
    }

    // only allowed for validators
    modifier onlyValidator() {
        require(validators[msg.sender], "Not validator");
        _;
    }
}
