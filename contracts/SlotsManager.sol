// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./ValidatorsContract.sol";
import "hardhat/console.sol";

contract SlotsManager is IBridgeContractStructs {
    address private bridgeContractAddress;
    ValidatorsContract private validatorsContract;
    address private owner;

    // BlockChainID -> CardanoBlock
    mapping(string => CardanoBlock) private lastObservedBlock;

    // BlockchanID -> hash(slot, hash) -> number of votes
    mapping(string => mapping(bytes32 => uint64)) private slotVotesPerChain;

    // BlockchanID -> hash(slot, hash) -> bool - validator voted already or not
    mapping(string => mapping(bytes32 => mapping(address => bool))) private slotValidatorVotedPerChain;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(address _bridgeContractAddress, address _validatorsContractAddress) external onlyOwner {
        bridgeContractAddress = _bridgeContractAddress;
        validatorsContract = ValidatorsContract(_validatorsContractAddress);
    }

    function updateBlocks(
        string calldata chainID,
        CardanoBlock[] calldata blocks,
        address _caller
    ) external onlyBridgeContract {
        // Check if the caller has already voted for this claim
        for (uint i = 0; i < blocks.length; i++) {
            CardanoBlock memory cblock = blocks[i];
            bytes32 chash = keccak256(abi.encodePacked(cblock.blockHash, cblock.blockSlot));
            if (slotValidatorVotedPerChain[chainID][chash][_caller]) {
                continue;
            }
            slotValidatorVotedPerChain[chainID][chash][_caller] = true;
            slotVotesPerChain[chainID][chash]++;
            if (
                slotVotesPerChain[chainID][chash] >= validatorsContract.getQuorumNumberOfValidators() &&
                cblock.blockSlot > lastObservedBlock[chainID].blockSlot
            ) {
                lastObservedBlock[chainID] = cblock;
            }
        }
    }

    function getLastObservedBlock(string calldata chainID) external view returns (CardanoBlock memory cb) {
        return lastObservedBlock[chainID];
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
}
