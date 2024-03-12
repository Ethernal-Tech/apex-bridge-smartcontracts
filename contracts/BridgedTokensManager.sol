// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import './ClaimsManager.sol';
import "hardhat/console.sol";

contract BridgedTokensManager is IBridgeContractStructs{
    ClaimsManager private claimsManager;

    // chainID => tokenQuantity;
    mapping(string => uint256) public chainTokenQuantity;
    // sourceChainID => destinationChainId => amount

    constructor(address _claimsManager) {
        claimsManager = ClaimsManager(_claimsManager);
    }

    function registerTokensTransfer(BridgingRequestClaim calldata _claim, uint256 _tokenQuantity) external onlyClaimsManager {

        chainTokenQuantity[_claim.sourceChainID] -= _tokenQuantity;
        chainTokenQuantity[_claim.destinationChainID] += _tokenQuantity;

    }

    modifier onlyClaimsManager() {
       if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        _;
    }

}