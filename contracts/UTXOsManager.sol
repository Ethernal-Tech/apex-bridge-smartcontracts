// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "hardhat/console.sol";

contract UTXOsManager is IBridgeContractStructs{
    BridgeContract private bridgeContract;

    // BLockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external view onlyBridgeContract returns (UTXOs memory availableUTXOs) {
        UTXOs memory utxos = chainUTXOs[_destinationChain];
        uint256 sum = 0;
        uint256 counterForArraySize;

        //counter - other option would required using storage variable
        for (uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            if ((sum + utxos.multisigOwnedUTXOs[i].amount) >= txCost) {
                counterForArraySize++;
                break;
            } else {
                sum = utxos.multisigOwnedUTXOs[i].amount;
                counterForArraySize++;
            }
        }

        availableUTXOs.multisigOwnedUTXOs = new UTXO[](counterForArraySize);
        availableUTXOs.feePayerOwnedUTXOs = new UTXO[](1);

        for (uint i = 0; i < counterForArraySize; i++) {
                availableUTXOs.multisigOwnedUTXOs[i] = utxos.multisigOwnedUTXOs[i];
        }

        availableUTXOs.feePayerOwnedUTXOs[0] = utxos.feePayerOwnedUTXOs[0];

        return availableUTXOs;
    }

    function updateUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyBridgeContract {
        _removeUsedUTXOs(_chainID);
        _addNewUTXOs(_chainID, _outputUTXOs);
        
    }

    function _removeUsedUTXOs(string calldata _chainID) internal {
        string memory lastSignedBatch = bridgeContract.lastConfirmedBatch(_chainID);
        UTXOs memory utxos;
        (, , , , , utxos) = bridgeContract.signedBatches(lastSignedBatch, 0);

        uint[] memory indices = new uint[](utxos.multisigOwnedUTXOs.length);

        for(uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            for(uint j = 0; j < chainUTXOs[_chainID].multisigOwnedUTXOs.length; j++) {
                if(keccak256(abi.encode(utxos.multisigOwnedUTXOs[i])) == keccak256(abi.encode(chainUTXOs[_chainID].multisigOwnedUTXOs[j]))) {
                    indices[i] = j;
                    break;
                }
            }
        }

        // TODO: better way?
        // delete used UTXOs
        for(uint i = 0; i < indices.length; i++) {
            delete chainUTXOs[_chainID].multisigOwnedUTXOs[indices[i]];
        }

        // //cleanup
        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs[indices[i]] = chainUTXOs[_chainID].multisigOwnedUTXOs[chainUTXOs[_chainID].multisigOwnedUTXOs.length - indices[i] - 1];
        }

        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs.pop();
        }

    }

    function _addNewUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) internal  {
        for(uint i = 0; i < _outputUTXOs.multisigOwnedUTXOs.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs.push(_outputUTXOs.multisigOwnedUTXOs[i]);
        }

        // TODO: for feePayerOwnedUTXOs to be implemented with consolidation of UTXOs
    }

    function pushUTXOs(string calldata _chainID, UTXOs calldata _UTXOs) external onlyBridgeContract {
        for(uint i = 0; i < _UTXOs.multisigOwnedUTXOs.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs.push(_UTXOs.multisigOwnedUTXOs[i]);
        }
        for(uint i = 0; i < _UTXOs.feePayerOwnedUTXOs.length; i++) {
            chainUTXOs[_chainID].feePayerOwnedUTXOs.push(_UTXOs.feePayerOwnedUTXOs[i]);
        }
    }

    function getChainUTXOs(string memory _chainID) external view returns (UTXOs memory) {
        return chainUTXOs[_chainID];
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

}