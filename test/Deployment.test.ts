import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { ethers } from "hardhat";
import { Validators } from "../typechain-types";

describe("Deployment", function () {
  it("Should set 5 validator with quorum of 4", async function () {
    const { validatorsc } = await loadFixture(deployBridgeFixture);

    // for 5 validators, quorum is 4
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(4);
  })

  it("Should set 6 validator with quorum of 5", async function () {
    const Validators = await ethers.getContractFactory("Validators");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");

    const validatorscLogic = await Validators.deploy();

    const [owner, validator1, validator2, validator3, validator4, validator5, validator6] = await ethers.getSigners();
    const validatorsAddresses = [
      validator1.address,
      validator2.address,
      validator3.address,
      validator4.address,
      validator5.address,
      validator6.address,
    ];

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, validatorsAddresses])
    );

    const ValidatorsDeployed = await ethers.getContractFactory("Validators");
    const validatorsc2 = ValidatorsDeployed.attach(validatorsProxy.target) as Validators;

    // for 6 validators, quorum is 5
    expect(await validatorsc2.getQuorumNumberOfValidators()).to.equal(5);
  });
});
