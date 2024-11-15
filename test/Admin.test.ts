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
});
