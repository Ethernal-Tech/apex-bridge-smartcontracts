// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "hardhat/console.sol";

contract UTXOsManager is IBridgeContractStructs{
    BridgeContract private bridgeContract;
    address private claimsManagerAddress;

    // Blockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;
    mapping(string => UTXOs) private chainUTXOsForConsolidation;

    // TODO: just a test value, this could be set on deployment
    // but could make sence to make it updatable
    uint256 private consolidationThreshold = 5;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function getAvailableUTXOs(
        string calldata _destinationChain,
        uint256 txCost
    ) external view onlyBridgeContract returns (UTXOs memory availableUTXOs) {

        //da prodje kroz consolidovane
        //proveri da li je dovoljno skupio
        //ako nije dovoljno skupio
        //predje na main
        uint256 sum = 0;
        uint256 counterForArraySizeConsolidation;

        if(chainUTXOsForConsolidation[_destinationChain].multisigOwnedUTXOs.length > 0) {
            for (uint i = 0; i < chainUTXOsForConsolidation[_destinationChain].multisigOwnedUTXOs.length; i++) {
                sum += chainUTXOsForConsolidation[_destinationChain].multisigOwnedUTXOs[i].amount;
                counterForArraySizeConsolidation++;
                if (sum  >= txCost) {
                    break;
                }
            }
            if (sum >= txCost) {
                availableUTXOs.multisigOwnedUTXOs = new UTXO[](counterForArraySizeConsolidation);
                availableUTXOs.feePayerOwnedUTXOs = new UTXO[](1);

                for (uint i = 0; i < counterForArraySizeConsolidation; i++) {
                    availableUTXOs.multisigOwnedUTXOs[i] = chainUTXOsForConsolidation[_destinationChain].multisigOwnedUTXOs[i];
                }

                availableUTXOs.feePayerOwnedUTXOs[0] = chainUTXOsForConsolidation[_destinationChain].feePayerOwnedUTXOs[0];

                return availableUTXOs;
            }
        }

        UTXOs memory utxos = chainUTXOs[_destinationChain];
        uint256 counterForArraySize;

        //counter - other option would required using storage variable
        for (uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            sum += utxos.multisigOwnedUTXOs[i].amount;
            counterForArraySize++;
            if (sum  >= txCost) {
                break;
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

    function updateUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaimsManager {
        _removeUsedUTXOs(_chainID);
        _addNewUTXOs(_chainID, _outputUTXOs);
        
    }

    function _removeUsedUTXOs(string calldata _chainID) internal {
        string memory lastSignedBatch = bridgeContract.lastConfirmedBatch(_chainID);
        UTXOs memory utxos;
        (, , , , , utxos) = bridgeContract.signedBatches(lastSignedBatch, 0);

        _removeMultisigUTXOs(_chainID, utxos);
        _removeFeeUTXOs(_chainID, utxos);

    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXOs memory utxos) internal {

        uint[] memory indices = new uint[](utxos.multisigOwnedUTXOs.length);

        // TODO: refactoring needed
        if (chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs.length > 0) {
            //remove from consolidation
            for(uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
                for(uint j = 0; j < chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs.length; j++) {
                    if(equalUTXO(utxos.multisigOwnedUTXOs[i], chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs[j])) {
                        indices[i] = j;
                        break;
                    }
                }
            }

            //cleanup
            for(uint i = 0; i < indices.length; i++) {
                chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs[indices[i]] = chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs[chainUTXOs[_chainID].multisigOwnedUTXOs.length - i - 1];
            }

            for(uint i = 0; i < indices.length; i++) {
                chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs.pop();
            }
        }
        
        //remove from main
        for(uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            for(uint j = 0; j < chainUTXOs[_chainID].multisigOwnedUTXOs.length; j++) {
                if(equalUTXO(utxos.multisigOwnedUTXOs[i], chainUTXOs[_chainID].multisigOwnedUTXOs[j])) {
                    indices[i] = j;
                    break;
                }
            }
        }

        //cleanup
        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs[indices[i]] = chainUTXOs[_chainID].multisigOwnedUTXOs[chainUTXOs[_chainID].multisigOwnedUTXOs.length - i - 1];
        }

        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].multisigOwnedUTXOs.pop();
        }

    }

    function _removeFeeUTXOs(string calldata _chainID, UTXOs memory utxos) internal {
        uint[] memory indices = new uint[](utxos.feePayerOwnedUTXOs.length);

        for(uint i = 0; i < utxos.feePayerOwnedUTXOs.length; i++) {
            for(uint j = 0; j < chainUTXOs[_chainID].feePayerOwnedUTXOs.length; j++) {
                if(equalUTXO(utxos.feePayerOwnedUTXOs[i], chainUTXOs[_chainID].feePayerOwnedUTXOs[j])) {
                    indices[i] = j;
                    break;
                }
            }
        }

        // //cleanup
        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].feePayerOwnedUTXOs[indices[i]] = chainUTXOs[_chainID].feePayerOwnedUTXOs[chainUTXOs[_chainID].feePayerOwnedUTXOs.length - i - 1];
        }

        for(uint i = 0; i < indices.length; i++) {
            chainUTXOs[_chainID].feePayerOwnedUTXOs.pop();
        }
    }

    function _addNewUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) internal  {
        for(uint i = 0; i < _outputUTXOs.multisigOwnedUTXOs.length; i++) {
            if(_outputUTXOs.multisigOwnedUTXOs[i].amount >= consolidationThreshold) {
                chainUTXOs[_chainID].multisigOwnedUTXOs.push(_outputUTXOs.multisigOwnedUTXOs[i]);
            } else {
                chainUTXOsForConsolidation[_chainID].multisigOwnedUTXOs.push(_outputUTXOs.multisigOwnedUTXOs[i]);
            }
        }

        for(uint i = 0; i < _outputUTXOs.feePayerOwnedUTXOs.length; i++) {
            chainUTXOs[_chainID].feePayerOwnedUTXOs.push(_outputUTXOs.feePayerOwnedUTXOs[i]);
        }
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

    function equalUTXO(UTXO memory a, UTXO memory b) public pure returns (bool) {
        return
            bytes(a.txHash).length == bytes(b.txHash).length && keccak256(bytes(a.txHash)) == keccak256(bytes(b.txHash)) &&
            a.txIndex == b.txIndex &&
            a.amount == b.amount;
    }

    function equalUTXOs(UTXOs memory a, UTXOs memory b) public pure returns (bool) {
        if(a.multisigOwnedUTXOs.length != b.multisigOwnedUTXOs.length ||
        a.feePayerOwnedUTXOs.length != b.feePayerOwnedUTXOs.length){
            return false;
        }

        for(uint256 i = 0; i < a.multisigOwnedUTXOs.length; i++) {
            if(!equalUTXO(a.multisigOwnedUTXOs[i], b.multisigOwnedUTXOs[i])) {
                return false;
            }
        }
        for(uint256 i = 0; i < a.feePayerOwnedUTXOs.length; i++) {
            if(!equalUTXO(a.feePayerOwnedUTXOs[i], b.feePayerOwnedUTXOs[i])) {
                return false;
            }   
        }

        return true;
    }

    // TODO: who will call this function?
    function setClaimsManagerAddress(address _claimsManagerAddress) external {
        claimsManagerAddress = _claimsManagerAddress;
    }

    modifier onlyBridgeContract() {
       if (msg.sender != address(bridgeContract)) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
       if (msg.sender != claimsManagerAddress) revert NotClaimsManager();
        _;
    }

}