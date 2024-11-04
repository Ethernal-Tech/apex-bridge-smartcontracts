import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Defund chain", function () {
  it("Should revert if defund is not called by defundAdmin", async function () {
    const { claims, validators, owner } = await loadFixture(deployBridgeFixture);

    await claims.setDefundOwner(validators[0].address);
    await expect(claims.connect(owner).defund(1, 100)).to.be.revertedWithCustomError(claims, "NotDefundAdmin");
  });

  it("Should revert when defund is called and chain is not registered", async function () {
    const { claims, validators } = await loadFixture(deployBridgeFixture);

    await claims.setDefundOwner(validators[0].address);
    await expect(claims.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
      claims,
      "ChainIsNotRegistered"
    );
  });
  it("Should revert when defund amount is higher then availableTokens amount", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setDefundOwner(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
    await expect(claims.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
      claims,
      "DefundRequestTooHigh"
    );
  });
});
