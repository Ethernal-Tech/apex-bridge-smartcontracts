import { ZeroAddress } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { ethers } from "hardhat";
import { Validators } from "../typechain-types";

describe("Deployment", function () {
  const getValidatorsSc = async function (cnt: number) {
    const { ownerGovernorContract } = await loadFixture(deployBridgeFixture);
    const Validators = await ethers.getContractFactory("Validators");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
    const validatorscLogic = await Validators.deploy();
    const [owner] = await ethers.getSigners();
    const { Wallet } = require("ethers");

    const randomAddresses = Array.from({ length: cnt }, () => {
      const wallet = Wallet.createRandom();
      return wallet.address;
    });

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [
        owner.address,
        await ownerGovernorContract.getAddress(),
        randomAddresses,
      ])
    );

    return (await ethers.getContractFactory("Validators")).attach(validatorsProxy.target) as Validators;
  };

  it("Should set 5 validator with quorum of 4", async function () {
    const { validatorsc } = await loadFixture(deployBridgeFixture);
    // for 5 validators, quorum is 4
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(4);
  });

  it("Should set 6 validator with quorum of 5", async function () {
    const validatorsc = await getValidatorsSc(6);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(5);
  });

  it("Should set 127 validator with quorum of 85", async function () {
    const validatorsc = await getValidatorsSc(127);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(85);
  });

  it("Quorum formula should work correctly 1 - 90", async function () {
    for (let i = 1; i <= 90; i++) {
      const validatorsc = await getValidatorsSc(i);
      // for 6 validators, quorum is 5
      expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(Math.floor((i * 2) / 3) + 1);
    }
  });

  it("Quorum formula should work correctly 91 - 127", async function () {
    for (let i = 91; i <= 127; i++) {
      const validatorsc = await getValidatorsSc(i);
      // for 6 validators, quorum is 5
      expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(Math.floor((i * 2) / 3) + 1);
    }
  });

  it("Revert if there are too many validators", async function () {
    await expect(getValidatorsSc(128)).to.revertedWith("Too many validators (max 127)");
  });

  it("setDependency should fail if any required argument is not smart contract address", async function () {
    const { owner, ownerGovernorContract, fundGovernorContract, validators } = await loadFixture(deployBridgeFixture);

    const Admin = await ethers.getContractFactory("Admin");
    const adminLogic = await Admin.deploy();

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridgeLogic = await Bridge.deploy();

    const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelperLogic = await ClaimsHelper.deploy();

    const Claims = await ethers.getContractFactory("Claims");
    const claimsLogic = await Claims.deploy();

    const SignedBatches = await ethers.getContractFactory("SignedBatches");
    const signedBatchesLogic = await SignedBatches.deploy();

    const Slots = await ethers.getContractFactory("Slots");
    const slotsLogic = await Slots.deploy();

    const Validators = await ethers.getContractFactory("Validators");
    const validatorscLogic = await Validators.deploy();

    // deployment of contract proxy
    const FundTokenProxy = await ethers.getContractFactory("ERC1967Proxy");
    const FundGovernorProxy = await ethers.getContractFactory("ERC1967Proxy");
    const OwnerTokenProxy = await ethers.getContractFactory("ERC1967Proxy");
    const OwnerGovernorProxy = await ethers.getContractFactory("ERC1967Proxy");
    const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");
    const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");

    const adminProxy = await AdminProxy.deploy(
      await adminLogic.getAddress(),
      Admin.interface.encodeFunctionData("initialize", [
        owner.address,
        await ownerGovernorContract.getAddress(),
        await fundGovernorContract.getAddress(),
      ])
    );

    const bridgeProxy = await BridgeProxy.deploy(
      await bridgeLogic.getAddress(),
      Bridge.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorContract.getAddress()])
    );

    const claimsProxy = await ClaimsProxy.deploy(
      await claimsLogic.getAddress(),
      Claims.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorContract.getAddress(), 2, 5])
    );

    const claimsHelperProxy = await ClaimsHelperProxy.deploy(
      await claimsHelperLogic.getAddress(),
      ClaimsHelper.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorContract.getAddress()])
    );

    const signedBatchesProxy = await SignedBatchesProxy.deploy(
      await signedBatchesLogic.getAddress(),
      SignedBatches.interface.encodeFunctionData("initialize", [
        owner.address,
        await ownerGovernorContract.getAddress(),
      ])
    );

    const slotsProxy = await SlotsProxy.deploy(
      await slotsLogic.getAddress(),
      Slots.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorContract.getAddress()])
    );

    const validatorsAddresses = [
      validators[0].address,
      validators[1].address,
      validators[2].address,
      validators[3].address,
      validators[4].address,
    ];

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [
        owner.address,
        await ownerGovernorContract.getAddress(),
        validatorsAddresses,
      ])
    );

    const AdminDeployed = await ethers.getContractFactory("Admin");
    const admin = AdminDeployed.attach(adminProxy.target) as Admin;

    const BridgeDeployed = await ethers.getContractFactory("Bridge");
    const bridge = BridgeDeployed.attach(bridgeProxy.target) as Bridge;

    const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelper = ClaimsHelperDeployed.attach(claimsHelperProxy.target) as ClaimsHelper;

    const ClaimsDeployed = await ethers.getContractFactory("Claims");
    const claims = ClaimsDeployed.attach(claimsProxy.target) as Claims;

    const SignedBatchesDeployed = await ethers.getContractFactory("SignedBatches");
    const signedBatches = SignedBatchesDeployed.attach(signedBatchesProxy.target) as SignedBatches;

    const SlotsDeployed = await ethers.getContractFactory("Slots");
    const slots = SlotsDeployed.attach(slotsProxy.target) as Slots;

    const ValidatorsDeployed = await ethers.getContractFactory("Validators");
    const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target) as Validators;

    await expect(admin.connect(owner).setDependencies(ZeroAddress)).to.be.revertedWithCustomError(
      admin,
      "NotContractAddress"
    );

    await expect(
      bridge
        .connect(owner)
        .setDependencies(
          validators[0].address,
          signedBatches.getAddress(),
          slots.getAddress(),
          validatorsc.getAddress()
        )
    ).to.be.revertedWithCustomError(bridge, "NotContractAddress");

    await expect(
      claims
        .connect(owner)
        .setDependencies(validators[1].address, claims.getAddress(), validatorsc.getAddress(), admin.getAddress())
    ).to.be.revertedWithCustomError(claims, "NotContractAddress");

    await expect(
      claimsHelper.connect(owner).setDependencies(validators[2].address, signedBatches.getAddress())
    ).to.be.revertedWithCustomError(claimsHelper, "NotContractAddress");

    await expect(
      signedBatches.connect(owner).setDependencies(validators[3].address, claims.getAddress(), validatorsc.getAddress())
    ).to.be.revertedWithCustomError(signedBatches, "NotContractAddress");

    await expect(
      slots.connect(owner).setDependencies(validators[4].address, validatorsc.getAddress())
    ).to.be.revertedWithCustomError(slots, "NotContractAddress");

    await expect(validatorsc.connect(owner).setDependencies(ZeroAddress)).to.be.revertedWithCustomError(
      validatorsc,
      "NotContractAddress"
    );
  });
  it("Should revert if there are duplicate validator addresses in Validatorsc initialize function", async function () {
    const { ownerGovernorContract } = await loadFixture(deployBridgeFixture);
    const [owner, validator1, validator2] = await ethers.getSigners();
    const Validators = await ethers.getContractFactory("Validators");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
    const validatorscLogic = await Validators.deploy();

    // Create array with duplicate addresses
    const validatorAddresses = [
      owner.address,
      validator1.address,
      validator2.address,
      validator1.address, // Duplicate address
    ];

    // Deploy proxy with initialization
    await expect(
      ValidatorscProxy.deploy(
        await validatorscLogic.getAddress(),
        Validators.interface.encodeFunctionData("initialize", [
          owner.address,
          await ownerGovernorContract.getAddress(),
          validatorAddresses,
        ])
      )
    ).to.be.revertedWithCustomError(Validators, "InvalidData");
  });
  it("Should revert if initializes with zero addresses for Owner or OwnerGovernor", async function () {
    const [, validator1, validator2, validator3, validator4] = await ethers.getSigners();

    const Admin = await ethers.getContractFactory("Admin");
    const AdminLogic = await Admin.deploy();
    const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    // Prepare initialization data with zero addresses
    let initData = Admin.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // OwnerGovernor address
      ZERO_ADDRESS, // FundGovernor address
    ]);
    // Deploy proxy with initialization
    await expect(AdminProxy.deploy(await AdminLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Admin,
      "ZeroAddress"
    );

    const Bridge = await ethers.getContractFactory("Bridge");
    const BridgeLogic = await Bridge.deploy();
    const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Prepare initialization data with zero addresses
    initData = Bridge.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // OwnerGovernor address
    ]);
    // Deploy proxy with initialization
    await expect(BridgeProxy.deploy(await BridgeLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Bridge,
      "ZeroAddress"
    );

    const Claims = await ethers.getContractFactory("Claims");
    const ClaimsLogic = await Claims.deploy();
    const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Prepare initialization data with zero addresses
    initData = Claims.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // ownerGovernor address
      10,
      10,
    ]);
    // Deploy proxy with initialization
    await expect(ClaimsProxy.deploy(await ClaimsLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Claims,
      "ZeroAddress"
    );

    const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
    const ClaimsHelperLogic = await ClaimsHelper.deploy();
    const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Prepare initialization data with zero addresses
    initData = ClaimsHelper.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // ownerGovernor address
    ]);
    // Deploy proxy with initialization
    await expect(
      ClaimsHelperProxy.deploy(await ClaimsHelperLogic.getAddress(), initData)
    ).to.be.revertedWithCustomError(ClaimsHelper, "ZeroAddress");

    const SignedBatches = await ethers.getContractFactory("SignedBatches");
    const SignedBatchesLogic = await SignedBatches.deploy();
    const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Prepare initialization data with zero addresses
    initData = SignedBatches.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // ownerGovernor address
    ]);
    // Deploy proxy with initialization
    await expect(
      SignedBatchesProxy.deploy(await SignedBatchesLogic.getAddress(), initData)
    ).to.be.revertedWithCustomError(SignedBatches, "ZeroAddress");

    const Slots = await ethers.getContractFactory("Slots");
    const SlotsLogic = await Slots.deploy();
    const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Prepare initialization data with zero addresses
    initData = Slots.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // ownerGovernor address
    ]);
    // Deploy proxy with initialization
    await expect(SlotsProxy.deploy(await SlotsLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Slots,
      "ZeroAddress"
    );

    const Validators = await ethers.getContractFactory("Validators");
    const validatorsLogic = await Validators.deploy();
    const ValidatorsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const validatorAddresses = [validator1.address, validator2.address, validator3.address, validator4.address];
    // Prepare initialization data with zero addresses
    initData = Validators.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // ownerGovernor address
      validatorAddresses,
    ]);
    // Deploy proxy with initialization
    await expect(ValidatorsProxy.deploy(await validatorsLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Validators,
      "ZeroAddress"
    );
  });
});
