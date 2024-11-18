import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Defund chain", function () {
  it("Should revert if defund is not called by fundAdmin", async function () {
    const { claims, validators, owner } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);
    await expect(claims.connect(owner).defund(1, 100)).to.be.revertedWithCustomError(claims, "NotFundAdmin");
  });

  it("Should revert when defund is called and chain is not registered", async function () {
    const { claims, validators } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);
    await expect(claims.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
      claims,
      "ChainIsNotRegistered"
    );
  });
  it("Should revert when defund amount is higher then availableTokens amount", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
    await expect(claims.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
      claims,
      "DefundRequestTooHigh"
    );
  });
  it("Should remove defund amount from availableTokens amount", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
    expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
    await claims.connect(validators[0]).defund(chain1.id, 1);
    expect(await claims.chainTokenQuantity(chain1.id)).to.equal(99);
  });
  it("Should emit ChainDefunded when defund is exdcuted", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    await claims.connect(validators[0]).defund(chain1.id, 1);

    await expect(await claims.connect(validators[0]).defund(chain1.id, 1))
      .to.emit(claims, "ChainDefunded")
      .withArgs(1, 1);
  });
  it("Should add confirmedTransactioin when defund is exdcuted", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    await claims.connect(validators[0]).defund(chain1.id, 1);

    expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

    await claims.connect(validators[0]).defund(chain1.id, 1);

    expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
  });
  it("Should set correct confirmedTransactioin when defund is exdcuted", async function () {
    const { bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

    await claims.setFundAdmin(validators[0].address);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    await claims.connect(validators[0]).defund(chain1.id, 1);

    expect((await claims.confirmedTransactions(chain1.id, 1)).observedTransactionHash).to.equal(
      await claims.defundHash()
    );
    expect((await claims.confirmedTransactions(chain1.id, 1)).sourceChainId).to.equal(chain1.id);
    expect((await claims.confirmedTransactions(chain1.id, 1)).nonce).to.equal(1);
    expect((await claims.confirmedTransactions(chain1.id, 1)).retryCounter).to.equal(0);
    expect((await claims.confirmedTransactions(chain1.id, 1)).totalAmount).to.equal(1);
    expect((await claims.confirmedTransactions(chain1.id, 1)).blockHeight).to.equal(24);
  });
});
