// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Utils.sol";
import "./Validators.sol";

contract Slots is IBridgeStructs, Utils, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private upgradeAdmin;

    address private bridgeAddress;
    Validators private validators;

    // BlockChainId -> CardanoBlock
    mapping(uint8 => CardanoBlock) private lastObservedBlock;

    // hash(slot, hash) -> number of votes
    mapping(bytes32 => uint8) private votes;

    // hash(slot, hash) -> bool - validator voted already or not
    mapping(bytes32 => mapping(address => bool)) private validatorVote;

    uint256 public testValue;

    // When adding new variables use one slot from the gap (decrease the gap array size)
    // Double check when setting structs or arrays
    uint256[49] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _upgradeAdmin) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        _transferOwnership(_owner);
        if (_owner == address(0)) revert ZeroAddress();
        if (_upgradeAdmin == address(0)) revert ZeroAddress();
        upgradeAdmin = _upgradeAdmin;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyUpgradeAdmin {}

    function setDependencies(address _bridgeAddress, address _validatorsAddress) external onlyOwner {
        if (!_isContract(_bridgeAddress) || !_isContract(_validatorsAddress)) revert NotContractAddress();
        bridgeAddress = _bridgeAddress;
        validators = Validators(_validatorsAddress);
    }

    function updateBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks, address _caller) external onlyBridge {
        // Check if the caller has already voted for this claim
        uint256 _quorumCnt = validators.getQuorumNumberOfValidators();
        uint256 _blocksLength = _blocks.length;
        for (uint i; i < _blocksLength; i++) {
            CardanoBlock calldata _cblock = _blocks[i];
            if (_cblock.blockSlot <= lastObservedBlock[_chainId].blockSlot) {
                continue;
            }

            bytes32 _chash = keccak256(abi.encodePacked(_chainId, _cblock.blockHash, _cblock.blockSlot));
            if (validatorVote[_chash][_caller]) {
                // no need for additional check: || slotVotesPerChain[_chash] >= _quorumCnt
                continue;
            }
            validatorVote[_chash][_caller] = true;
            uint256 _votesNum;
            unchecked {
                _votesNum = ++votes[_chash];
            }
            if (_votesNum >= _quorumCnt) {
                lastObservedBlock[_chainId] = _cblock;
            }
        }
    }

    function getLastObservedBlock(uint8 _chainId) external view returns (CardanoBlock memory _cb) {
        return lastObservedBlock[_chainId];
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }

    modifier onlyUpgradeAdmin() {
        if (msg.sender != upgradeAdmin) revert NotOwner();
        _;
    }
}
