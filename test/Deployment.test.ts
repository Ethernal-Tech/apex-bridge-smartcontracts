import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { ethers } from "hardhat";
import { Validators } from "../typechain-types";

describe("Deployment", function () {
  let getValidatorsSc = async function (cnt: number) {
    const Validators = await ethers.getContractFactory("Validators");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");

    const validatorscLogic = await Validators.deploy();

    const [owner, validator] = await ethers.getSigners();
    let validatorsAddresses = []
    for (let i = 1; i <= cnt; i++) {
      validatorsAddresses.push(validator.address)
    }

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, validatorsAddresses])
    );

    return (await ethers.getContractFactory("Validators")).attach(validatorsProxy.target) as Validators;
  }

  it("Should set 5 validator with quorum of 4", async function () {
    const { validatorsc } = await loadFixture(deployBridgeFixture);
    // for 5 validators, quorum is 4
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(4);
  })

  it("Should set 6 validator with quorum of 5", async function () {
    const validatorsc = await getValidatorsSc(6);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(5);
  });

  it("Should set 6 validator with quorum of 127", async function () {
    const validatorsc = await getValidatorsSc(127);
    // for 6 validators, quorum is 5
    expect(await validatorsc.getQuorumNumberOfValidators()).to.equal(85);
  });

  it("Revert if there are too many validators", async function () {
    await expect(getValidatorsSc(128)).to.revertedWith("Too many validators (max 127)");;
  });
});
