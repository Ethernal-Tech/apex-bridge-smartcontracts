import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("ClaimsHelper Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).setConfirmedSignedBatchData(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotSignedBatchesOrClaims"
      );
    });

    it("Should revert if ClaimsHelper SC setVotedOnlyIfNeeded is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper
          .connect(owner)
          .setVotedOnlyIfNeeded(owner.address, "0x7465737600000000000000000000000000000000000000000000000000000000", 1)
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatchesOrClaims");
    });

    it("Should revert if ClaimsHelper SC setVoted is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper
          .connect(owner)
          .setVoted(owner.address, "0x7465737600000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatchesOrClaims");
    });
  });
  describe("Submit token amount data", function () {
    it("Should revert if Bridge SC submitChainStatusData is not called by Validator", async function () {
      const { bridge, owner, cardanoBlocks, tokenAmounts } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).submitChainStatusData(1, cardanoBlocks, tokenAmounts)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });
    it("Should revert for Bridge SC submitChainStatusData vhen chain is not registered", async function () {
      const { bridge, validators, cardanoBlocks, tokenAmounts } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts)
      ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");
    });
    it("Token amount should NOT be updated if there is no consensus", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      expect(await bridge.getTokenQuantity(1)).to.equal(0);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(0);
    });
    it("Token amount should be updated if there is consensus", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(0);

      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(1000);
    });

    it("Token amount should NOT be updated if there is consensus, but slot number is lower than previous", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks, tokenAmounts } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, validatorsCardanoData);

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(0);

      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(1000);

      tokenAmounts[1].blockSlot = 1;
      tokenAmounts[1].amount = 1000000;

      await bridge.connect(validators[0]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[1]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[2]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);
      await bridge.connect(validators[3]).submitChainStatusData(1, cardanoBlocks, tokenAmounts);

      expect(await bridge.getTokenQuantity(1)).to.equal(1000);
    });
  });
});
