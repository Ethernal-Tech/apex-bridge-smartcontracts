import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Admin Functions", function () {
  beforeEach(async () => {
    // mock isSignatureValid precompile to always return true
    await setCode("0x0000000000000000000000000000000000002050", "0x600160005260206000F3");
    await setCode("0x0000000000000000000000000000000000002060", "0x600160005260206000F3");
  });

  describe("Chain Token Quantity", function () {
    it("Should revert any claim if not called by owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        admin,
        "OwnableUnauthorizedAccount"
      );
    });
    it("Should revert if updateChainTokenQuantity is called on unregistered chain", async function () {
      const { admin, claims } = await loadFixture(deployBridgeFixture);
      await expect(admin.updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        claims,
        "ChainIsNotRegistered"
      );
    });
    it("Should revert if setChainTokenQuantity in Clais is not called by Admin contract", async function () {
      const { admin, claims } = await loadFixture(deployBridgeFixture);
      await expect(claims.updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        claims,
        "NotAdminContract"
      );
    });
    it("Should increase chainTokenQuantity after calling updateChainTokenQuantity", async function () {
      const { admin, bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainTokenQuantity(chain1.id, true, 100);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(200);
    });
    it("Should emit event after increaseint chain token quantity with updateChainTokenQuantity", async function () {
      const { admin, bridge, claims, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.updateChainTokenQuantity(chain1.id, true, 100)).to.emit(admin, "UpdatedChainTokenQuantity");
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(200);
    });
    it("Should revert if decreae amount is higher than available chainTokenQuantity", async function () {
      const { admin, bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await expect(admin.updateChainTokenQuantity(1, false, 200)).to.be.revertedWithCustomError(
        admin,
        "NegativeChainTokenAmount"
      );
    });
    it("Should decrease chainTokenQuantity by required amount", async function () {
      const { admin, bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await admin.updateChainTokenQuantity(chain1.id, false, 50);
    });
    it("Should emit event after decreasing chain token quantity with updateChainTokenQuantity", async function () {
      const { bridge, admin, claims, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await expect(admin.updateChainTokenQuantity(chain1.id, false, 50)).to.emit(admin, "UpdatedChainTokenQuantity");
    });
  });
  describe("Setting FundAdmin", function () {
    it("Should revert setFundAdmin is not called by owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).setFundAdmin(validators[0])).to.be.revertedWithCustomError(
        admin,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert if FundAdmin is ZeroAddress", async function () {
      const { admin } = await loadFixture(deployBridgeFixture);

      await expect(admin.setFundAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(admin, "ZeroAddress");
    });

    it("Should set fundAdmin when called by Owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);

      expect(await admin.fundAdmin()).to.be.equal(validators[0].address);
    });
    it("Should emit ChangedFundAdmin when new fundAdmin is set ", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(await admin.setFundAdmin(validators[0].address))
        .to.emit(admin, "FundAdminChanged")
        .withArgs(validators[0].address);
    });
  });
  describe("Defund chain", function () {
    it("Should revert if defund is not called by fundAdmin", async function () {
      const { admin, validators, owner } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);
      await expect(admin.connect(owner).defund(1, 100)).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert when defund is called and chain is not registered", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);
      await expect(admin.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
        admin,
        "ChainIsNotRegistered"
      );
    });
    it("Should revert when defund amount is higher then availableTokens amount", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
      await expect(admin.connect(validators[0]).defund(1, 100)).to.be.revertedWithCustomError(
        claims,
        "DefundRequestTooHigh"
      );
    });
    it("Should remove defund amount from availableTokens amount", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.connect(validators[0]).defund(chain1.id, 1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(99);
    });
    it("Should emit ChainDefunded when defund is exdcuted", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await admin.connect(validators[0]).defund(chain1.id, 1);

      await expect(await admin.connect(validators[0]).defund(chain1.id, 1))
        .to.emit(admin, "ChainDefunded")
        .withArgs(1, 1);
    });
    it("Should add confirmedTransactioin when defund is exdcuted", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await admin.connect(validators[0]).defund(chain1.id, 1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

      await admin.connect(validators[0]).defund(chain1.id, 1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });
    it("Should set correct confirmedTransactioin when defund is exdcuted", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await admin.connect(validators[0]).defund(chain1.id, 1);

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
});
