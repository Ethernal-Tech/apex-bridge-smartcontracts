// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "hardhat/console.sol";

contract SlotsManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    
    // BlockChainID -> CardanoBlock
    mapping(string => CardanoBlock) private lastObservedBlock;

    // BlockchanID -> hash(slot, hash) -> number of votes
    mapping(string => mapping(bytes32 => uint64)) private slotVotesPerChain;

    // BlockchanID -> hash(slot, hash) -> bool - validator voted already or not
    mapping(string => mapping(bytes32 => mapping(address => bool))) private slotValidatorVotedPerChain;

    constructor(address _bridgeContract) {
        bridgeContract = BridgeContract(_bridgeContract);
    }

    function updateBlocks(string calldata chainID, CardanoBlock[] calldata blocks, address _caller) external onlyBridgeContract {
        // Check if the caller has already voted for this claim
        for (uint i = 0; i < blocks.length; i++) {
            CardanoBlock memory cblock = blocks[i];
            bytes32 chash = keccak256(abi.encodePacked(cblock.blockHash, cblock.blockSlot));
            if (slotValidatorVotedPerChain[chainID][chash][_caller]) {
                continue;
            }
            slotValidatorVotedPerChain[chainID][chash][_caller] = true;
            slotVotesPerChain[chainID][chash]++;
            if (slotVotesPerChain[chainID][chash] >= bridgeContract.getQuorumNumberOfValidators() &&
                cblock.blockSlot > lastObservedBlock[chainID].blockSlot) {
                lastObservedBlock[chainID] = cblock;
            }
        }
    }

    function getLastObservedBlock(string calldata chainID) external view returns (CardanoBlock memory cb) {
        return lastObservedBlock[chainID];
    }

    modifier onlyBridgeContract() {
        if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }
}