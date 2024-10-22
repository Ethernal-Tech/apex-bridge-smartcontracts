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
    mapping(bytes32 => uint8) private numberOfVotes;

    // hash(slot, hash) -> bool - validator voted already or not
    mapping(bytes32 => mapping(address => bool)) private hasVoted;

    // claimHash for pruning
    ClaimHash[] public claimsHashes;

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
                claimsHashes.push(ClaimHash(_chash, block.number));
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

    function pruneHasVotedAndNumberOfVotes(uint256 _quorumCount, address[] calldata _validators) external onlyOwner {
        uint256 i = 0;
        while (i < claimsHashes.length) {
            bytes32 _hashValue = claimsHashes[i].hashValue;
            if (numberOfVotes[_hashValue] >= _quorumCount || block.number - claimsHashes[i].blockNumber >= 100) {
                for (uint256 j = 0; j < _validators.length; j++) {
                    delete hasVoted[_hashValue][_validators[j]];
                }
                delete numberOfVotes[claimsHashes[i].hashValue];
                delete claimsHashes[i];
                claimsHashes[i] = claimsHashes[claimsHashes.length - 1];
                claimsHashes.pop();
            }
            i++;
        }
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
