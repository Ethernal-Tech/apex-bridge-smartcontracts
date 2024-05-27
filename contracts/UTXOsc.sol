// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

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

    function addNewBridgingUTXO(string calldata _chainID, UTXO memory _utxo) public onlyClaims {
        _utxo.nonce = ++utxoNonceCounter;
        chainUTXOs[_chainID].multisigOwnedUTXOs.push(_utxo);
    }

    function addUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaims {
        _addNewUTXOs(_chainID, _outputUTXOs);
    }

    function removeUsedUTXOs(string calldata _chainID, UTXOs calldata _utxos) external onlyClaims {
        _removeMultisigUTXOs(_chainID, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainID, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXO[] calldata utxos) internal {
        uint lenu = chainUTXOs[_chainID].multisigOwnedUTXOs.length;
        uint i;
        while (i < lenu) {
            bool shouldDelete = false;
            uint256 utxosLength = utxos.length;
            for (uint j; j < utxosLength; j++) {
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
                //prettier-ignore
                unchecked { i++; }
            }
        }
    }

    function _removeFeeUTXOs(string calldata _chainID, UTXO[] calldata utxos) internal {
        uint lenu = chainUTXOs[_chainID].feePayerOwnedUTXOs.length;
        uint i;
        while (i < lenu) {
            bool shouldDelete = false;
            uint256 utxosLength = utxos.length;
            for (uint j; j < utxosLength; j++) {
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
                //prettier-ignore
                unchecked { i++; }
            }
        }
    }

    function _addNewUTXOs(string calldata _chainID, UTXOs calldata utxos) internal {
        uint256 utxosMultisigOwnedUTXOsLength = utxos.multisigOwnedUTXOs.length;
        for (uint i; i < utxosMultisigOwnedUTXOsLength; ) {
            UTXO memory dt = utxos.multisigOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].multisigOwnedUTXOs.push(dt);

            //prettier-ignore
            unchecked { i++; }
        }

        uint256 utxosFeePayerOwnedUTXOs = utxos.multisigOwnedUTXOs.length;
        for (uint i; i < utxosFeePayerOwnedUTXOs; i++) {
            UTXO memory dt = utxos.feePayerOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].feePayerOwnedUTXOs.push(dt);
        }
    }

    function setInitialUTxOs(string calldata _chainID, UTXOs calldata _UTXOs) external onlyBridge {
        _addNewUTXOs(_chainID, _UTXOs);
    }

    function equalUTXO(UTXO calldata a, UTXO memory b) public pure returns (bool) {
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
