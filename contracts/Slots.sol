// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IBridgeStructs.sol";
import "./Validators.sol";

contract Slots is IBridgeStructs, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address private bridgeAddress;
    Validators private validators;

    // BlockChainId -> CardanoBlock
    mapping(uint8 => CardanoBlock) private lastObservedBlock;

    // BlockchanId -> hash(slot, hash) -> number of votes
    mapping(uint8 => mapping(bytes32 => uint64)) private slotVotesPerChain;

    // BlockchanId -> hash(slot, hash) -> bool - validator voted already or not
    mapping(uint8 => mapping(bytes32 => mapping(address => bool))) private slotValidatorVotedPerChain;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setDependencies(address _bridgeAddress, address _validatorsAddress) external onlyOwner {
        bridgeAddress = _bridgeAddress;
        validators = Validators(_validatorsAddress);
    }

    function updateBlocks(uint8 _chainId, CardanoBlock[] calldata _blocks, address _caller) external onlyBridge {
        // Check if the caller has already voted for this claim
        uint256 blockLength = _blocks.length;
        for (uint i; i < blockLength; i++) {
            CardanoBlock calldata cblock = _blocks[i];
            bytes32 chash = keccak256(abi.encodePacked(cblock.blockHash, cblock.blockSlot));
            if (slotValidatorVotedPerChain[_chainId][chash][_caller]) {
                continue;
            }
            slotValidatorVotedPerChain[_chainId][chash][_caller] = true;
            slotVotesPerChain[_chainId][chash]++;
            if (
                slotVotesPerChain[_chainId][chash] >= validators.getQuorumNumberOfValidators() &&
                cblock.blockSlot > lastObservedBlock[_chainId].blockSlot
            ) {
                lastObservedBlock[_chainId] = cblock;
            }
        }
    }

    function getLastObservedBlock(uint8 _chainId) external view returns (CardanoBlock memory _cb) {
        return lastObservedBlock[_chainId];
    }

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert NotBridge();
        _;
    }
}
