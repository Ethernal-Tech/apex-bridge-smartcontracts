// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

interface IBLS {
    /**
     * @notice verifies a single signature
     * @param signature 64-byte G1 group element (small sig)
     * @param pubkey 128-byte G2 group element (big pubkey)
     * @param message message signed to produce signature
     * @return bool sig verification
     * @return bool indicating call success
     */
    function verifySingle(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external view returns (bool, bool);

    /**
     * @notice hashes an arbitrary message to a point on the curve
     * @dev Fouque-Tibouchi Hash to Curve
     * @param domain domain separator for the hash
     * @param message the message to map
     * @return uint256[2] (x,y) point on the curve that the message maps to
     */
    function hashToPoint(bytes32 domain, bytes memory message) external view returns (uint256[2] memory);
}

struct ApexStakeValidator {
    address addr;
    uint256[4] blsKey;
    bool isWhitelisted;
    bool isActive;
}

struct ApexGenesisValidator {
    address addr;
    uint256[4] blsKey;
}

contract ApexStakeManager is Initializable, Ownable2StepUpgradeable {
    error Unauthorized(string _message);
    error InvalidSignature(address _validatorAdrr);
    event AddedToWhitelist(address indexed _validatorAdrr);
    event RemovedFromWhitelist(address indexed _validatorAdrr);
    event ValidatorRegistered(address indexed _validatorAdrr, uint256[4] _blsKey, uint256 _amount);
    event ValidatorUnregistered(address indexed _validatorAdrr);

    IBLS private bls;
    bytes32 public domain;

    uint256 private totalValidatorsStake;

    mapping(address => ApexStakeValidator) public validators;

    modifier onlyValidator(address validator) {
        if (!validators[validator].isActive) revert Unauthorized("VALIDATOR");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _bls,
        string calldata _domainString,
        ApexGenesisValidator[] calldata _genesisValidators
    ) public initializer {
        bls = IBLS(_bls);
        domain = keccak256(abi.encodePacked(_domainString));
        uint256 validatorsCount = _genesisValidators.length;
        for (uint256 i = 0; i < validatorsCount; i += 1) {
            address addr = _genesisValidators[i].addr;
            validators[addr] = ApexStakeValidator(addr, _genesisValidators[i].blsKey, true, true);
        }
        totalValidatorsStake = validatorsCount;
        _transferOwnership(_owner);
    }

    function stake(uint256 amount) external onlyValidator(msg.sender) {
        // do nothing
    }

    function unstake(uint256 amount) external onlyValidator(msg.sender) {
        // do nothing
    }

    function totalStake() external view returns (uint256) {
        return totalValidatorsStake;
    }

    function stakeOf(address _validatorAddr) external view returns (uint256) {
        return validators[_validatorAddr].isActive ? 1 : 0;
    }

    function whitelistValidators(address[] calldata validators_) external onlyOwner {
        uint256 length = validators_.length;
        for (uint256 i = 0; i < length; i += 1) {
            _addToWhitelist(validators_[i]);
        }
    }

    function registerByAdmin(
        address _validatorAddr,
        uint256[4] calldata _pubkey
    ) external onlyOwner {
        ApexStakeValidator storage validator = validators[_validatorAddr];
        if (!validator.isActive) {
            totalValidatorsStake += 1;
        }
        validator.isActive = true;
        validator.isWhitelisted = true;
        validator.blsKey = _pubkey;
        validator.addr = _validatorAddr;
        emit ValidatorRegistered(_validatorAddr, _pubkey, 1);
    }

    function unregisterByAdmin(address _validatorAddr) external onlyOwner {
        ApexStakeValidator storage validator = validators[_validatorAddr];
        if (validator.isActive || validator.isWhitelisted) {
            if (validator.isActive) {
                totalValidatorsStake -= 1;
            }
            delete validators[_validatorAddr];
            emit ValidatorUnregistered(_validatorAddr);
        }
    }

    function register(uint256[2] calldata _signature, uint256[4] calldata _pubkey, uint256 _stakeAmount) external {
        ApexStakeValidator storage validator = validators[msg.sender];
        if (!validator.isWhitelisted) revert Unauthorized("WHITELIST");
        _verifyValidatorRegistration(msg.sender, _signature, _pubkey);
        if (!validator.isActive) {
            totalValidatorsStake += 1;
        }
        validator.isActive = true;
        validator.blsKey = _pubkey;
        validator.addr = msg.sender;
        emit ValidatorRegistered(msg.sender, _pubkey, _stakeAmount);
    }

    function getValidator(address _validatorAddr) external view returns (ApexStakeValidator memory) {
        return validators[_validatorAddr];
    }

    function withdraw() external {
        // do nothing
    }

    function withdrawable(address) external pure returns (uint256 amount) {
        return 0;
    }

    function pendingWithdrawals(address) external pure returns (uint256) {
        return 0;
    }

    function totalSupplyAt(uint256) external view returns (uint256) {
        // the reward is zero, so the return value of this function is irrelevant
        return totalValidatorsStake;
    }

    function balanceOfAt(address _validatorAddr, uint256) external view returns (uint256) {
        // the reward is zero, so the return value of this function is irrelevant
        return validators[_validatorAddr].isActive ? 1 : 0;
    }

    function _addToWhitelist(address validatorAddr) internal {
        validators[validatorAddr].isWhitelisted = true;
        emit AddedToWhitelist(validatorAddr);
    }

    function _removeFromWhitelist(address validatorAddr) internal {
        validators[validatorAddr].isWhitelisted = false;
        emit RemovedFromWhitelist(validatorAddr);
    }

    function _verifyValidatorRegistration(
        address _signer,
        uint256[2] calldata _signature,
        uint256[4] calldata _pubkey
    ) internal view {
        /// @dev signature verification succeeds if signature and pubkey are empty
        if (_signature[0] == 0 && _signature[1] == 0) revert InvalidSignature(_signer);
        // slither-disable-next-line calls-loop
        bytes memory _hash = abi.encodePacked(_signer, address(this), block.chainid);
        // slither-disable-next-line calls-loop_signer
        uint256[2] memory _point = bls.hashToPoint(domain, _hash);
        (bool _result, bool _callSuccess) = bls.verifySingle(_signature, _pubkey, _point);
        if (!_callSuccess || !_result) revert InvalidSignature(_signer);
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[48] private __gap;
}
