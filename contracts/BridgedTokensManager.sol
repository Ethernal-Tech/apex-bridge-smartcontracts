// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import './ClaimsManager.sol';
import "hardhat/console.sol";

contract BridgedTokensManager is IBridgeContractStructs{
    address private claimsManagerAddress;
    address private bridgeContractAddress;

    // chainID => tokenQuantity;
    mapping(string => uint256) public chainTokenQuantity;

    constructor(address _bridgeContractAddress, address _claimsManagerAddress) {
        bridgeContractAddress = _bridgeContractAddress;
        claimsManagerAddress = _claimsManagerAddress;
    }

    function registerTokensTransfer(BridgingRequestClaim calldata _claim, uint256 _tokenQuantity) external onlyClaimsManager {

        chainTokenQuantity[_claim.sourceChainID] -= _tokenQuantity;
        chainTokenQuantity[_claim.destinationChainID] += _tokenQuantity;

    }

    function setTokenQuantity(string calldata _chainId, uint256 _tokenQuantity) external onlyBridgeContract {
        chainTokenQuantity[_chainId] = _tokenQuantity;
    }

    modifier onlyClaimsManager() {
       if (msg.sender != claimsManagerAddress) revert NotClaimsManager();
        _;
    }

    modifier onlyBridgeContract() {
       if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }

}