import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { Wallet } from "ethers";

describe("Deployment", function () {
  const getValidatorsSc = async function (cnt) {
    const Validators = await connection.ethers.getContractFactory("Validators");
    const ValidatorscProxy = await connection.ethers.getContractFactory("UUPSProxy");
    const validatorscLogic = await Validators.deploy();
    const [owner] = await connection.ethers.getSigners();

    const randomAddresses = Array.from({ length: cnt }, () => {
      const wallet = Wallet.createRandom();
      return wallet.address;
    });

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, randomAddresses])
    );

    return (await connection.ethers.getContractFactory("Validators")).attach(validatorsProxy.target);
  };

  it("Should set 5 validator with quorum of 4", async function () {
    // for 5 validators, quorum is 4
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(4);
  });

  it("Should set 6 validator with quorum of 5", async function () {
    const validatorsc = await getValidatorsSc(6);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(5);
  });

  //Initialzation transaction would fail due to gas limit if we try to deploy more then 115 validators in local hardhat network
  it("Should set 115 validator with quorum of 77", async function () {
    const validatorsc = await getValidatorsSc(115);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(77);
  });

  it("Quorum formula should work correctly 1 - 90", async function () {
    for (let i = 1; i <= 90; i++) {
      const validatorsc = await getValidatorsSc(i);
      // for 6 validators, quorum is 5
      expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(Math.floor((i * 2) / 3) + 1);
    }
  });

  //Initialzation transaction would fail due to gas limit if we try to deploy more then 115 validators in local hardhat network
  it("Quorum formula should work correctly 91 - 115", async function () {
    for (let i = 91; i <= 115; i++) {
      const validatorsc = await getValidatorsSc(i);
      // for 6 validators, quorum is 5
      expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(Math.floor((i * 2) / 3) + 1);
    }
  });

  it("Revert if there are too many validators", async function () {
    await expect(getValidatorsSc(128)).to.revertedWith("Too many validators (max 127)");
  });

  it("setDependency should fail if any required argument is not smart contract address", async function () {
    await expect(admin.connect(owner).setDependencies(connection.ethers.ZeroAddress)).to.be.revertedWithCustomError(
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

    await expect(
      validatorsc.connect(owner).setDependencies(connection.ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(validatorsc, "NotContractAddress");
  });

  it("Should revert if there are duplicate validator addresses in Validatorsc initialize function", async function () {
    const [owner, validator1, validator2] = await connection.ethers.getSigners();
    // Deploy implementation contract
    const Validators = await connection.ethers.getContractFactory("Validators");
    const validatorsLogic = await Validators.deploy();
    // Deploy proxy contract
    const ValidatorsProxy = await connection.ethers.getContractFactory("UUPSProxy");
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
    await expect(ValidatorsProxy.deploy(await validatorsLogic.getAddress(), initData))
      .to.be.revertedWithCustomError(Validators, "InvalidData")
      .withArgs("DuplicatedValidator");
  });

  it("Should revert if initializes with zero addresses for owner and upgrade admin", async function () {
    const [, validator1, validator2, validator3, validator4] = await connection.ethers.getSigners();

    const Admin = await connection.ethers.getContractFactory("Admin");
    const AdminLogic = await Admin.deploy();
    const AdminProxy = await connection.ethers.getContractFactory("UUPSProxy");
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

    const Bridge = await connection.ethers.getContractFactory("Bridge");
    const BridgeLogic = await Bridge.deploy();
    const BridgeProxy = await connection.ethers.getContractFactory("UUPSProxy");
    // Prepare initialization data with zero addresses
    initData = Bridge.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // upgrade admin address
    ]);
    // Deploy proxy with initialization
    await expect(BridgeProxy.deploy(await BridgeLogic.getAddress(), initData)).to.be.revertedWithCustomError(
      Bridge,
      "ZeroAddress"
    );

    const Claims = await connection.ethers.getContractFactory("Claims");
    const ClaimsLogic = await Claims.deploy();
    const ClaimsProxy = await connection.ethers.getContractFactory("UUPSProxy");
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

    const ClaimsHelper = await connection.ethers.getContractFactory("ClaimsHelper");
    const ClaimsHelperLogic = await ClaimsHelper.deploy();
    const ClaimsHelperProxy = await connection.ethers.getContractFactory("UUPSProxy");
    // Prepare initialization data with zero addresses
    initData = ClaimsHelper.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // upgrade admin address
    ]);
    // Deploy proxy with initialization
    await expect(
      ClaimsHelperProxy.deploy(await ClaimsHelperLogic.getAddress(), initData)
    ).to.be.revertedWithCustomError(ClaimsHelper, "ZeroAddress");

    const SignedBatches = await connection.ethers.getContractFactory("SignedBatches");
    const SignedBatchesLogic = await SignedBatches.deploy();
    const SignedBatchesProxy = await connection.ethers.getContractFactory("UUPSProxy");
    // Prepare initialization data with zero addresses
    initData = SignedBatches.interface.encodeFunctionData("initialize", [
      ZERO_ADDRESS, // owner address
      ZERO_ADDRESS, // upgrade admin address
    ]);
    // Deploy proxy with initialization
    await expect(
      SignedBatchesProxy.deploy(await SignedBatchesLogic.getAddress(), initData)
    ).to.be.revertedWithCustomError(SignedBatches, "ZeroAddress");

    const Slots = await connection.ethers.getContractFactory("Slots");
    const SlotsLogic = await Slots.deploy();
    const SlotsProxy = await connection.ethers.getContractFactory("UUPSProxy");
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

    const Validators = await connection.ethers.getContractFactory("Validators");
    const validatorsLogic = await Validators.deploy();
    const ValidatorsProxy = await connection.ethers.getContractFactory("UUPSProxy");
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

  let bridge;
  let claims;
  let claimsHelper;
  let signedBatches;
  let slots;
  let validatorsc;
  let admin;
  let owner;
  let validators;
  let connection;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    claims = fixture.claims;
    claimsHelper = fixture.claimsHelper;
    signedBatches = fixture.signedBatches;
    slots = fixture.slots;
    validatorsc = fixture.validatorsc;
    admin = fixture.admin;
    owner = fixture.owner;
    validators = fixture.validators;
    connection = fixture.connection;
  });
});
