// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IBridgeContractStructs.sol";
import "hardhat/console.sol";
import "./SlotsManager.sol";

contract ClaimsHelper is IBridgeContractStructs {
    address private claimsManagerAddress;
    address private signedBatchManagerAddress;
    address private owner;

    // blockchain -> claimHash -> queued
    mapping(string => mapping(string => bool)) public isClaimConfirmed;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(address _claimsManagerAddress, address _signedBatchManagerAddress) external onlyOwner {
        claimsManagerAddress = _claimsManagerAddress;
        signedBatchManagerAddress = _signedBatchManagerAddress;
    }

    function setClaimConfirmed(
        string calldata _chain,
        string calldata _observerHash
    ) external onlySignedBatchManagerOrClaimsManager {
        isClaimConfirmed[_chain][_observerHash] = true;
    }

    function _equal(string memory a, string memory b) internal pure returns (bool) {
        return bytes(a).length == bytes(b).length && keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _equalReveivers(Receiver[] memory a, Receiver[] memory b) internal pure returns (bool) {
        if (a.length != b.length) {
            return false;
        }

        for (uint256 i = 0; i < a.length; i++) {
            if (a[i].amount != b[i].amount || !_equal(a[i].destinationAddress, b[i].destinationAddress)) {
                return false;
            }
        }

        return true;
    }

    modifier onlyOwner() {
        if (msg.sender != address(owner)) revert NotOwner();
        _;
    }

    modifier onlySignedBatchManagerOrClaimsManager() {
        if (msg.sender != address(signedBatchManagerAddress) && msg.sender != address(claimsManagerAddress))
            revert NotSignedBatchManagerOrBridgeContract();
        _;
    }
}
