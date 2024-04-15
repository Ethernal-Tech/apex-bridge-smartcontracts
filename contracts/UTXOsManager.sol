// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./SignedBatchManager.sol";
import "hardhat/console.sol";

contract UTXOsManager is IBridgeContractStructs {
    address private bridgeContractAddress;
    address private claimsManagerAddress;
    address private owner;

    uint64 private utxoNonceCounter;

    // Blockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;

    function initialize() public {
        owner = msg.sender;
    }

    function setDependencies(address _bridgeContractAddress, address _claimsManagerAddress) external onlyOwner {
        bridgeContractAddress = _bridgeContractAddress;
        claimsManagerAddress = _claimsManagerAddress;
    }

    function getChainUTXOs(string memory _chainID) external view returns (UTXOs memory) {
        return chainUTXOs[_chainID];
    }

    function addNewBridgingUTXO(string calldata _chainID, UTXO calldata _utxo) public onlyClaimsManager {
        UTXO memory tempUtxo = _utxo;
        tempUtxo.nonce = ++utxoNonceCounter;
        chainUTXOs[_chainID].multisigOwnedUTXOs.push(tempUtxo);
    }

    function addUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaimsManager {
        _addNewUTXOs(_chainID, _outputUTXOs);
    }

    function removeUsedUTXOs(string calldata _chainID, UTXOs calldata _utxos) external onlyClaimsManager {
        _removeMultisigUTXOs(_chainID, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainID, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXO[] memory utxos) internal {
        uint i = 0;
        uint lenu = chainUTXOs[_chainID].multisigOwnedUTXOs.length;
        while (i < lenu) {
            bool shouldDelete = false;
            for (uint j = 0; j < utxos.length; j++) {
                if (equalUTXO(utxos[j], chainUTXOs[_chainID].multisigOwnedUTXOs[i])) {
                    shouldDelete = true;
                    break;
                }
            }

            if (shouldDelete) {
                // move last element to current and then remove pop last element from array
                lenu--;
                chainUTXOs[_chainID].multisigOwnedUTXOs[i] = chainUTXOs[_chainID].multisigOwnedUTXOs[lenu];
                chainUTXOs[_chainID].multisigOwnedUTXOs.pop();
            } else {
                i++;
            }
        }
    }

    function _removeFeeUTXOs(string calldata _chainID, UTXO[] memory utxos) internal {
        uint lenu = chainUTXOs[_chainID].feePayerOwnedUTXOs.length;
        uint i = 0;
        while (i < lenu) {
            bool shouldDelete = false;
            for (uint j = 0; j < utxos.length; j++) {
                if (equalUTXO(utxos[j], chainUTXOs[_chainID].feePayerOwnedUTXOs[i])) {
                    shouldDelete = true;
                    break;
                }
            }

            if (shouldDelete) {
                // move last element to current and then remove pop last element from array
                lenu--;
                chainUTXOs[_chainID].feePayerOwnedUTXOs[i] = chainUTXOs[_chainID].feePayerOwnedUTXOs[lenu];
                chainUTXOs[_chainID].feePayerOwnedUTXOs.pop();
            } else {
                i++;
            }
        }
    }

    function _addNewUTXOs(string calldata _chainID, UTXOs calldata utxos) internal {
        for (uint i = 0; i < utxos.multisigOwnedUTXOs.length; i++) {
            UTXO memory dt = utxos.multisigOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].multisigOwnedUTXOs.push(dt);
        }

        for (uint i = 0; i < utxos.feePayerOwnedUTXOs.length; i++) {
            UTXO memory dt = utxos.feePayerOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].feePayerOwnedUTXOs.push(dt);
        }
    }

    function setInitialUTxOs(string calldata _chainID, UTXOs calldata _UTXOs) external onlyBridgeContract {
        _addNewUTXOs(_chainID, _UTXOs);
    }

    function equalUTXO(UTXO memory a, UTXO memory b) public pure returns (bool) {
        // for UTXO comparing nonce is not important
        return
            bytes(a.txHash).length == bytes(b.txHash).length &&
            keccak256(bytes(a.txHash)) == keccak256(bytes(b.txHash)) &&
            a.txIndex == b.txIndex &&
            a.amount == b.amount;
    }

    modifier onlyBridgeContract() {
        if (msg.sender != bridgeContractAddress) revert NotBridgeContract();
        _;
    }

    modifier onlyClaimsManager() {
        if (msg.sender != claimsManagerAddress) revert NotClaimsManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
}
