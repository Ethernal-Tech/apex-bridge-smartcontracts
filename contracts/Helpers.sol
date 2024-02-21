// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContract.sol";

contract Helpers is IBridgeContractStructs {

    // Blockchain ID -> claimsCounter
    mapping(string => uint64) internal claimsCounter;
    mapping(string => mapping(address => bool)) internal voters;
    mapping(string => uint8) internal numberOfVotes;
    uint8 internal validatorsCount;

    function getClaimsCounter(string calldata _chainId) external view returns (uint256) {
        return claimsCounter[_chainId];
    }

    function _hasVoted(string calldata _id) internal view returns (bool) {
        return voters[_id][msg.sender];
    }

    function _hasConsensus(string calldata _id) internal view returns (bool) {
        if (numberOfVotes[_id] >= ((validatorsCount * 2) / 3 + ((validatorsCount * 2) % 3 == 0 ? 0 : 1))) {
            return true;
        }
        return false;
    }
    
}