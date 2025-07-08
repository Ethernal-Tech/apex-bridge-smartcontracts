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

    it("Should revert if ClaimsHelper SC setConfirmedSignedBatchData is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).setConfirmedSignedBatchData(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotSignedBatchesOrClaims"
      );
    });

    it("Should revert if ClaimsHelper SC setVotedOnlyIfNeededReturnQuorumReached is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper
          .connect(owner)
          .setVotedOnlyIfNeededReturnQuorumReached(
            1,
            "0x7465737600000000000000000000000000000000000000000000000000000000",
            1
          )
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatchesOrClaims");
    });
  });
  describe("Submit new Stake Delegation Transaction", function () {
    it("Should revert if ClaimsHelper SC addStakeDelegationTransactions is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner, chain1 } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).addStakeDelegationTransactions(chain1.id, "stakePoolId")).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should revert if ClaimsHelper SC setLastBatchedStakeDelTxNonce is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner, chain1 } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).setLastBatchedStakeDelTxNonce(chain1.id, 1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should revert if ClaimsHelper SC retryStakeDelTxs is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner, chain1 } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).retryStakeDelTxs(chain1.id, 1, 2)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });
  });
});
