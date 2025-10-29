// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";
import "./Validators.sol";

/// @title Slots Contract
/// @notice Manages observation of Cardano blocks and validator votes across multiple chains.
/// @dev Uses upgradeable proxy pattern (UUPS). Ensures block updates are quorum-approved.
contract Slots is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;
    address private bridgeAddress;
    Validators private validators;

    /// @notice Mapping from chain ID to the last observed Cardano block
    /// @dev BlockChainId -> CardanoBlock
    mapping(uint8 => CardanoBlock) private lastObservedBlock;

    /// @notice Mapping from (chain ID, block hash, slot) hash to bitmap contains all validator votes.
    /// @dev hash(slot, hash) -> bitmap
    mapping(bytes32 => uint256) private bitmap;

    uint8 constant MAX_NUMBER_OF_BLOCKS = 40;

    /// @dev Reserved storage slots for future upgrades. When adding new variables
    ///      use one slot from the gap (decrease the gap array size).
    ///      Double check when setting structs or arrays.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with owner and upgrade admin.
    /// @param _owner The address to set as contract owner.
    /// @param _upgradeAdmin The address authorized to upgrade the contract.
    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    /// @notice Authorizes upgrades. Only the upgrade admin can upgrade the contract.
    /// @param newImplementation Address of the new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    /// @notice Sets external contract dependencies.
    /// @param _bridgeAddress Address of the bridge contract.
    /// @param _validatorsAddress Address of the validators contract.
    function setDependencies(address _bridgeAddress, address _validatorsAddress) external onlyOwner {
        if (!_isContract(_bridgeAddress) || !_isContract(_validatorsAddress)) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        validators = Validators(_validatorsAddress);
    }

    /// @notice Updates the last observed block for a given chain based on validator votes.
    /// @dev Each validator can vote once per unique `(chainId, blockHash, blockSlot)` combination.
    ///      When the number of votes for a block reaches quorum, that block becomes the latest observed.
    /// @param _chainId The ID of the blockchain for which blocks are being updated.
    /// @param _blocks An array of `CardanoBlock` objects containing block metadata to process.
    /// @param _caller The address of the validator submitting the block votes.
    function updateBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks, address _caller) external onlyBridge {
        if (_blocks.length > MAX_NUMBER_OF_BLOCKS) {
            revert TooManyBlocks(_blocks.length, MAX_NUMBER_OF_BLOCKS);
        }

        // Check if the caller has already voted for this claim
        uint256 _quorumCnt = validators.getQuorumNumberOfValidators();
        uint8 _validatorIdx = validators.getValidatorIndex(_caller) - 1;
        uint256 _blocksLength = _blocks.length;
        CardanoBlock memory _lastObservedBlock = lastObservedBlock[_chainId];
        uint256 _bitmapValue;
        uint256 _bitmapNewValue;
        bytes32 _chash;
        uint256 _votesNum;

        for (uint i; i < _blocksLength; ++i) {
            CardanoBlock calldata _cblock = _blocks[i];
            if (_cblock.blockSlot <= _lastObservedBlock.blockSlot) {
                continue;
            }

            _chash = keccak256(abi.encodePacked(_chainId, _cblock.blockHash, _cblock.blockSlot));
            _bitmapValue = bitmap[_chash];
            unchecked {
                _bitmapNewValue = _bitmapValue | (1 << _validatorIdx);
            }

            // check if caller already voted for same hash and skip if he did
            if (_bitmapValue == _bitmapNewValue) {
                continue;
            }

            bitmap[_chash] = _bitmapNewValue;

            // Brian Kernighan's algorithm
            // @see https://github.com/estarriolvetch/solidity-bits/blob/main/contracts/Popcount.sol
            unchecked {
                for (_votesNum = 0; _bitmapNewValue != 0; _votesNum++) {
                    _bitmapNewValue &= _bitmapNewValue - 1;
                }
            }

            if (_votesNum >= _quorumCnt) {
                _lastObservedBlock = _cblock;
                // can delete because of check
                //  if (_cblock.blockSlot <= _lastObservedBlock.blockSlot)
                delete bitmap[_chash];
            }
        }

        lastObservedBlock[_chainId] = _lastObservedBlock;
    }

    function getLastObservedBlock(uint8 _chainId) external view returns (CardanoBlock memory _cb) {
        return lastObservedBlock[_chainId];
    }

    /// @notice Returns the current version of the contract
    /// @return A semantic version string
    function version() public pure returns (string memory) {
        return "1.0.1";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotUpgradeAdmin();
        _;
    }
}
