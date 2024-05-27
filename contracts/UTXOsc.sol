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

    // BlockchainId -> UTXOs
    mapping(uint8 => UTXOs) private chainUTXOs;

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

    function getChainUTXOs(uint8 _chainId) external view returns (UTXOs memory) {
        return chainUTXOs[_chainId];
    }

    function addNewBridgingUTXO(uint8 _chainId, UTXO memory _utxo) public onlyClaims {
        _utxo.nonce = ++utxoNonceCounter;
        chainUTXOs[_chainId].multisigOwnedUTXOs.push(_utxo);
    }

    function addUTXOs(uint8 _chainId, UTXOs calldata _outputUTXOs) external onlyClaims {
        _addNewUTXOs(_chainId, _outputUTXOs);
    }

    function removeUsedUTXOs(uint8 _chainId, UTXOs calldata _utxos) external onlyClaims {
        _removeMultisigUTXOs(_chainId, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainId, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(uint8 _chainId, UTXO[] calldata utxos) internal {
        uint lenu = chainUTXOs[_chainId].multisigOwnedUTXOs.length;
        uint i;
        while (i < lenu) {
            bool shouldDelete = false;
            uint256 utxosLength = utxos.length;
            for (uint j; j < utxosLength; j++) {
                if (equalUTXO(utxos[j], chainUTXOs[_chainId].multisigOwnedUTXOs[i])) {
                    shouldDelete = true;
                    break;
                }
            }

            if (shouldDelete) {
                // move last element to current and then remove pop last element from array
                lenu--;
                chainUTXOs[_chainId].multisigOwnedUTXOs[i] = chainUTXOs[_chainId].multisigOwnedUTXOs[lenu];
                chainUTXOs[_chainId].multisigOwnedUTXOs.pop();
            } else {
                //prettier-ignore
                unchecked { i++; }
            }
        }
    }

    function _removeFeeUTXOs(uint8 _chainId, UTXO[] calldata utxos) internal {
        uint lenu = chainUTXOs[_chainId].feePayerOwnedUTXOs.length;
        uint i;
        while (i < lenu) {
            bool shouldDelete = false;
            uint256 utxosLength = utxos.length;
            for (uint j; j < utxosLength; j++) {
                if (equalUTXO(utxos[j], chainUTXOs[_chainId].feePayerOwnedUTXOs[i])) {
                    shouldDelete = true;
                    break;
                }
            }

            if (shouldDelete) {
                // move last element to current and then remove pop last element from array
                lenu--;
                chainUTXOs[_chainId].feePayerOwnedUTXOs[i] = chainUTXOs[_chainId].feePayerOwnedUTXOs[lenu];
                chainUTXOs[_chainId].feePayerOwnedUTXOs.pop();
            } else {
                //prettier-ignore
                unchecked { i++; }
            }
        }
    }

    function _addNewUTXOs(uint8 _chainId, UTXOs calldata utxos) internal {
        uint256 utxosMultisigOwnedUTXOsLength = utxos.multisigOwnedUTXOs.length;
        for (uint i; i < utxosMultisigOwnedUTXOsLength; ) {
            UTXO memory dt = utxos.multisigOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainId].multisigOwnedUTXOs.push(dt);

            //prettier-ignore
            unchecked { i++; }
        }

        uint256 utxosFeePayerOwnedUTXOs = utxos.multisigOwnedUTXOs.length;
        for (uint i; i < utxosFeePayerOwnedUTXOs; ) {
            UTXO memory dt = utxos.feePayerOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainId].feePayerOwnedUTXOs.push(dt);

            //prettier-ignore
            unchecked { i++; }
        }
    }

    function setInitialUTxOs(uint8 _chainId, UTXOs calldata _UTXOs) external onlyBridge {
        _addNewUTXOs(_chainId, _UTXOs);
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
