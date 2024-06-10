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

    mapping(bytes32 => uint) private feePos;

    mapping(bytes32 => uint) private multisigPos;

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
        
        bytes32 _hash = keccak256(abi.encodePacked(_utxo.txHash, _utxo.txIndex));
        multisigPos[_hash] = chainUTXOs[_chainID].multisigOwnedUTXOs.length;
    }

    function addUTXOs(string calldata _chainID, UTXOs calldata _outputUTXOs) external onlyClaims {
        _addNewUTXOs(_chainID, _outputUTXOs);
    }

    function removeUsedUTXOs(string calldata _chainID, UTXOs calldata _utxos) external onlyClaims {
        _removeMultisigUTXOs(_chainID, _utxos.multisigOwnedUTXOs);
        _removeFeeUTXOs(_chainID, _utxos.feePayerOwnedUTXOs);
    }

    function _removeMultisigUTXOs(string calldata _chainID, UTXO[] calldata _utxos) internal {
        uint ulen = _utxos.length;
        uint[] memory _deletePosList = new uint[](ulen);
        
        for (uint i; i < ulen; i++) {
            bytes32 _hash = keccak256(abi.encodePacked(_utxos[i].txHash, _utxos[i].txIndex));
            uint _pos = multisigPos[_hash]; // we can assume that there is no consensus for invalid data :)
            delete multisigPos[_hash];
            _deletePosList[i] = _pos - 1;
        }

        _deletePosList = sortArray(_deletePosList);

        uint _idx = chainUTXOs[_chainID].multisigOwnedUTXOs.length;

        for (uint i; i < ulen; i++) {
            uint _pos = _deletePosList[i];
            _idx--;
            chainUTXOs[_chainID].multisigOwnedUTXOs[_pos] = chainUTXOs[_chainID].multisigOwnedUTXOs[_idx];
            chainUTXOs[_chainID].multisigOwnedUTXOs.pop();
        }
    }

    function _removeFeeUTXOs(string calldata _chainID, UTXO[] calldata utxos) internal {
        uint ulen = utxos.length;
        uint[] memory _deletePosList = new uint[](ulen);
        
        for (uint i; i < ulen; i++) {
            bytes32 _hash = keccak256(abi.encodePacked(utxos[i].txHash, utxos[i].txIndex));
            uint _pos = feePos[_hash]; // we can assume that there is no consensus for invalid data :)
            delete feePos[_hash];
            _deletePosList[i] = _pos - 1;
        }

        _deletePosList = sortArray(_deletePosList);

        uint _idx = chainUTXOs[_chainID].feePayerOwnedUTXOs.length;

        for (uint i; i < ulen; i++) {
            uint _pos = _deletePosList[i];
            _idx--;
            chainUTXOs[_chainID].feePayerOwnedUTXOs[_pos] = chainUTXOs[_chainID].feePayerOwnedUTXOs[_idx];
            chainUTXOs[_chainID].feePayerOwnedUTXOs.pop();
        }
    }

    function _addNewUTXOs(string calldata _chainID, UTXOs calldata utxos) internal {
        uint256 utxosMultisigOwnedUTXOsLength = utxos.multisigOwnedUTXOs.length;
        uint idx = chainUTXOs[_chainID].multisigOwnedUTXOs.length;
        for (uint i; i < utxosMultisigOwnedUTXOsLength; i++) {
            UTXO memory dt = utxos.multisigOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].multisigOwnedUTXOs.push(dt);

            bytes32 _hash = keccak256(abi.encodePacked(dt.txHash, dt.txIndex));
            multisigPos[_hash] = ++idx;
        }

        uint256 utxosFeePayerOwnedUTXOs = utxos.feePayerOwnedUTXOs.length;
        idx = chainUTXOs[_chainID].feePayerOwnedUTXOs.length;
        for (uint i; i < utxosFeePayerOwnedUTXOs; i++) {
            UTXO memory dt = utxos.feePayerOwnedUTXOs[i];
            dt.nonce = ++utxoNonceCounter;
            chainUTXOs[_chainID].feePayerOwnedUTXOs.push(dt);

            bytes32 _hash = keccak256(abi.encodePacked(dt.txHash, dt.txIndex));
            feePos[_hash] = ++idx;
        }
    }

    // sortArray sorts array of uints in descending order TODO: move sortArray to precompile
    function sortArray(uint[] memory arr) internal pure returns (uint[] memory) {
        uint n = arr.length;

        for (uint i = 0; i < n; i++) {
            for (uint j = 0; j < (n - i - 1); j++) {
                if (arr[j] < arr[j + 1]) { // descending
                    uint temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
 
        return arr;
    }

    function setInitialUTxOs(string calldata _chainID, UTXOs calldata _UTXOs) external onlyBridge {
        _addNewUTXOs(_chainID, _UTXOs);
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
