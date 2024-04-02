// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "./interfaces/IBridgeContractStructs.sol";
import "./BridgeContract.sol";
import "./SignedBatchManager.sol";
import "hardhat/console.sol";

contract UTXOsManager is IBridgeContractStructs {
    BridgeContract private bridgeContract;
    SignedBatchManager private signedBatchManager;
    address private claimsManagerAddress;

    uint64 private utxoNonceCounter;

    // Blockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;

    constructor(address _bridgeContractAddress) {
        bridgeContract = BridgeContract(_bridgeContractAddress);
    }

    function getChainUTXOs(string memory _chainID) external view returns (UTXOs memory) {
        return chainUTXOs[_chainID];
    }

    function updateUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaimsManager {
        _removeUsedUTXOs(_chainID);
        _addNewUTXOs(_chainID, _outputUTXOs);
    }

    function _removeUsedUTXOs(string calldata _chainID) internal {
        uint256 _signedBatchNounce = signedBatchManager.lastConfirmedBatchNounce(_chainID);
        UTXOs memory _utxos;
        (, , , , , _utxos) = signedBatchManager.confirmedSignedBatches(_chainID, _signedBatchNounce);

        _removeMultisigUTXOs(_chainID, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainID, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXO[] memory utxos) internal {
        uint i = 0;
        uint lenu = chainUTXOs[_chainID].multisigOwnedUTXOs.length;
        for (; i < lenu; ) {
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
        for (; i < lenu; ) {
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
            a.amount == a.amount;
    }

    // TODO: who will call this function?
    function setClaimsManagerAddress(address _claimsManagerAddress) external {
        claimsManagerAddress = _claimsManagerAddress;
    }

    function setSignedBatchManagerAddress(address _signedBatchManagerAddress) external {
        signedBatchManager = SignedBatchManager(_signedBatchManagerAddress);
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
