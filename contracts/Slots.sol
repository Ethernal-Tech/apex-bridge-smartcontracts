// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Validators.sol";

contract Slots is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    Validators private validators;

    // BlockChainId -> CardanoBlock
    mapping(uint8 => CardanoBlock) private lastObservedBlock;

    // hash(slot, hash) -> number of votes
    mapping(bytes32 => uint8) public numberOfVotes;

    // hash(slot, hash) -> bool - validator voted already or not
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    // claimHash for pruning
    ClaimHash[] public slotsHashes;
    uint256 public constant MIN_CLAIM_BLOCK_AGE = 100; //TODO SET THIS VALUE TO AGREED ON

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress, address _validatorsAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        validators = Validators(_validatorsAddress);
    }

    function updateBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks, address _caller) external onlyBridge {
        // Check if the caller has already voted for this claim
        uint256 _quorumCnt = validators.getQuorumNumberOfValidators();
        uint256 _blocksLength = _blocks.length;
        for (uint i; i < _blocksLength; i++) {
            CardanoBlock calldata _cblock = _blocks[i];
            if (_cblock.blockSlot <= lastObservedBlock[_chainId].blockSlot) {
                continue;
            }

            bytes32 _chash = keccak256(abi.encodePacked(_chainId, _cblock.blockHash, _cblock.blockSlot));
            if (hasVoted[_chash][_caller]) {
                // no need for additional check: || slotVotesPerChain[_chash] >= _quorumCnt
                continue;
            }
            hasVoted[_chash][_caller] = true;

            if (numberOfVotes[_chash] == 0) {
                slotsHashes.push(ClaimHash(_chash, block.number));
            }

            uint256 _votesNum;
            unchecked {
                _votesNum = ++numberOfVotes[_chash];
            }
            if (_votesNum >= _quorumCnt) {
                lastObservedBlock[_chainId] = _cblock;
            }
        }
    }

    function getLastObservedBlock(uint8 _chainId) external view returns (CardanoBlock memory _cb) {
        return lastObservedBlock[_chainId];
    }

    function pruneSlots(address[] calldata _validators, uint256 _deleteToBlock) external onlyOwner {
        if (MIN_CLAIM_BLOCK_AGE + _deleteToBlock > block.number) revert TTLTooLow();
        uint256 i = 0;
        while (i < slotsHashes.length) {
            bytes32 _hashValue = slotsHashes[i].hashValue;
            if (block.number - slotsHashes[i].blockNumber >= _deleteToBlock) {
                for (uint256 j = 0; j < _validators.length; j++) {
                    delete hasVoted[_hashValue][_validators[j]];
                }
                delete numberOfVotes[slotsHashes[i].hashValue];
                slotsHashes[i] = slotsHashes[slotsHashes.length - 1];
                slotsHashes.pop();
            } else {
                i++;
            }
        }
    }

    function getSlotsHashes() external view returns (ClaimHash[] memory) {
        return slotsHashes;
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
