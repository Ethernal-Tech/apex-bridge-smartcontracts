import { ZeroAddress } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { ethers } from "hardhat";
import { Validators } from "../typechain-types";

describe("Deployment", function () {
  const getValidatorsSc = async function (cnt: number) {
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
      Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, randomAddresses])
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

  it("setDependency should fail if any argument is zeroAddress", async function () {
    const { admin, bridge, claims, claimsHelper, signedBatches, slots, validatorsc, owner } = await loadFixture(
      deployBridgeFixture
    );

    await expect(admin.connect(owner).setDependencies(ZeroAddress)).to.be.revertedWithCustomError(admin, "ZeroAddress");

    await expect(
      bridge
        .connect(owner)
        .setDependencies(ZeroAddress, signedBatches.getAddress(), slots.getAddress(), validatorsc.getAddress())
    ).to.be.revertedWithCustomError(bridge, "ZeroAddress");

    await expect(
      claims
        .connect(owner)
        .setDependencies(ZeroAddress, claims.getAddress(), validatorsc.getAddress(), admin.getAddress())
    ).to.be.revertedWithCustomError(claims, "ZeroAddress");

    await expect(
      claimsHelper.connect(owner).setDependencies(ZeroAddress, signedBatches.getAddress())
    ).to.be.revertedWithCustomError(claimsHelper, "ZeroAddress");

    await expect(
      signedBatches.connect(owner).setDependencies(ZeroAddress, claims.getAddress(), validatorsc.getAddress())
    ).to.be.revertedWithCustomError(signedBatches, "ZeroAddress");

    await expect(
      slots.connect(owner).setDependencies(ZeroAddress, validatorsc.getAddress())
    ).to.be.revertedWithCustomError(slots, "ZeroAddress");

    await expect(validatorsc.connect(owner).setDependencies(ZeroAddress)).to.be.revertedWithCustomError(
      validatorsc,
      "ZeroAddress"
    );
  });
  it("Should revert if there are duplicate validator addresses in Validatorsc initialize function", async function () {
    const [owner, validator1, validator2] = await ethers.getSigners();
    // Deploy implementation contract
    const Validators = await ethers.getContractFactory("Validators");
    const validatorsLogic = await Validators.deploy();
    // Deploy proxy contract
    const ValidatorsProxy = await ethers.getContractFactory("ERC1967Proxy");
    // Create array with duplicate addresses
    const validatorAddresses = [
      owner.address,
      validator1.address,
      validator2.address,
      validator1.address, // Duplicate address
    ];
    // Prepare initialization data
    const initData = Validators.interface.encodeFunctionData("initialize", [
      owner.address,
      owner.address,
      validatorAddresses,
    ]);
    // Deploy proxy with initialization
    await expect(ValidatorsProxy.deploy(await validatorsLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Validators,
      "InvalidData"
    );
  });
  it("Should revert if initializes with zero addresses for owner and upgrade admin", async function () {
    const [, validator1, validator2, validator3, validator4] = await ethers.getSigners();

    const Admin = await ethers.getContractFactory("Admin");
    const AdminLogic = await Admin.deploy();
    const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    // Prepare initialization data with zero addresses
    let initData = Admin.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // upgrade admin address
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
    initData = Admin.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // upgrade admin address
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
      ZERO_ADDRESS, // upgrade admin address
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
      ZERO_ADDRESS, // upgrade admin address
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
      ZERO_ADDRESS, // upgrade admin address
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
      ZERO_ADDRESS, // upgrade admin address
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
      ZERO_ADDRESS, // upgrade admin address
      validatorAddresses,
    ]);
    // Deploy proxy with initialization
    await expect(ValidatorsProxy.deploy(await validatorsLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Validators,
      "ZeroAddress"
    );
  });
});
