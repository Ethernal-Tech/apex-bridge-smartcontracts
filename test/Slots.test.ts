import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Slots Contract", function () {
  beforeEach(async () => {
    // mock isSignatureValid precompile to always return true
    await setCode("0x0000000000000000000000000000000000002050", "0x600160005260206000F3");
  });

  describe("Slot management", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, cardanoBlocks, tokenAmounts } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts)
      ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");
    });

    it("Should revert if not called by validator", async function () {
      const { bridge, owner, cardanoBlocks, tokenAmounts } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).submitChainStatusData(1, cardanoBlocks, tokenAmounts)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should skip if validator submitted the same CardanoBlocks twice", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);
    });

    it("Should update CardanoBlock when there is quorum", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("Should not update CardanoBlock when slot is not newer", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);

      const cardanoBlocksOld = [
        {
          blockSlot: 0,
          blockHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        },
      ];

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocksOld, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocksOld, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocksOld, tokenAmounts);
      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocksOld, tokenAmounts);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("updateBlocks from Slots SC should revert if not called by Bridge SC", async function () {
      const { bridge, slots, owner, cardanoBlocks } = await loadFixture(deployBridgeFixture);

      await expect(slots.connect(owner).updateBlocks(1, cardanoBlocks, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });
  });
});
