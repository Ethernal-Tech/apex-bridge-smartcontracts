// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";

contract UTXOsc is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    address private claimsAddress;

    uint64 private utxoNonceCounter;

    // Blockchain ID -> UTXOs
    mapping(string => UTXOs) private chainUTXOs;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress, address _claimsAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        claimsAddress = _claimsAddress;
    }

    function getChainUTXOs(string calldata _chainID) external view returns (UTXOs memory) {
        return chainUTXOs[_chainID];
    }

    function addNewBridgingUTXO(string calldata _chainID, UTXO calldata _utxo) public onlyClaims {
        UTXO memory tempUtxo = _utxo;
        tempUtxo.nonce = ++utxoNonceCounter;
        chainUTXOs[_chainID].multisigOwnedUTXOs.push(tempUtxo);
    }

    function addUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaims {
        _addNewUTXOs(_chainID, _outputUTXOs);
    }

    function removeUsedUTXOs(string calldata _chainID, UTXOs calldata _utxos) external onlyClaims {
        _removeMultisigUTXOs(_chainID, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainID, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXO[] calldata utxos) internal {
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

    function _removeFeeUTXOs(string calldata _chainID, UTXO[] calldata utxos) internal {
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

    function setInitialUTxOs(string calldata _chainID, UTXOs calldata _UTXOs) external onlyBridge {
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

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsAddress) revert NotClaims();
        _;
    }
}
