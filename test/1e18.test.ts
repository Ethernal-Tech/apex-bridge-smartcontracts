import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Convert 1e6 to 1e18", function () {
  describe("Convert 1e6 to 1e18", function () {
    it("Should revert if pauseBridging is not called by fundAdmin", async function () {
      await expect(admin.connect(validators[0]).pauseBridging(true)).to.be.revertedWithCustomError(
        admin,
        "NotFundAdmin"
      );
    });

    it("Should revert if amountsTo1e18 is not called by fundAdmin", async function () {
      await expect(admin.connect(validators[0]).amountsTo1e18()).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert if amountsTo1e18 is not called when bridging is not paused", async function () {
      await expect(admin.connect(owner).amountsTo1e18()).to.be.revertedWithCustomError(admin, "BridgingNotPaused");
    });

    it("Should revert amountsTo1e18 if batch is still pending", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatchEVM(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatchEVM(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatchEVM(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatchEVM(signedBatch);

      await admin.connect(owner).pauseBridging(true);

      await expect(admin.connect(owner).amountsTo1e18())
        .to.be.revertedWithCustomError(admin, "BatchStillPending")
        .withArgs(1);
    });

    it("Should revert BRC claims if briding is paused", async function () {
      await admin.connect(owner).pauseBridging(true);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "BridgingPaused"
      );
    });

    it("Should revert RRC claims if briding is paused", async function () {
      await admin.connect(owner).pauseBridging(true);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "BridgingPaused"
      );
    });

    it("Should revert HWIC claims if briding is paused", async function () {
      await admin.connect(owner).pauseBridging(true);

      await expect(bridge.connect(validators[0]).submitClaims(calidatorClaimsHWIC)).to.be.revertedWithCustomError(
        bridge,
        "BridgingPaused"
      );
    });

    it("Should allow BEC claims if briding is paused", async function () {
      await admin.connect(owner).pauseBridging(true);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC)).not.to.be.reverted;
    });

    it("Should allow BEFC claims if briding is paused", async function () {
      await admin.connect(owner).pauseBridging(true);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC)).not.to.be.reverted;
    });

    it("shouldCreateBatch should always return false if bridging is paused", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await ethers.provider.send("evm_mine");
      }

      await admin.connect(owner).pauseBridging(true);

      expect(await bridge.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        false
      );
    });

    it("Should update receivers in confirmedTransaction that were not yet batched", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );
      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      for (let i = lastBatchedTxNonce + 1n; i <= lastConfirmedTxNonce; i++) {
        const tx = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );

        expect(tx.receivers[0].amount).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount);
        expect(tx.receivers[0].amountWrapped).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped
        );
      }

      await admin.connect(owner).pauseBridging(true);

      await admin.connect(owner).amountsTo1e18();

      for (let i = lastBatchedTxNonce + 1n; i <= lastConfirmedTxNonce; i++) {
        const tx = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );

        expect(tx.receivers[0].amount).to.equal(
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount) * 1_000_000_000_000n
        );
        expect(tx.receivers[0].amountWrapped).to.equal(
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped) * 1_000_000_000_000n
        );
      }
    });

    it("Should revert if amounts are already converted", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      await admin.connect(owner).pauseBridging(true);

      await admin.connect(owner).amountsTo1e18();

      await expect(admin.connect(owner).amountsTo1e18()).to.be.revertedWithCustomError(
        admin,
        "AmountsAlreadyConverted"
      );
    });

    it("Should NOT update receivers in confirmedTransaction that WERE batched", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let confirmedTransactionBefore = [];

      for (let i = 1; i <= lastConfirmedTxNonce; i++) {
        confirmedTransactionBefore[i] = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );
      }

      await admin.connect(owner).pauseBridging(true);

      await admin.connect(owner).amountsTo1e18();

      for (let i = 1; i <= lastConfirmedTxNonce; i++) {
        const tx = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );

        expect(confirmedTransactionBefore[i].totalAmount).to.equal(tx.totalAmount);
        expect(confirmedTransactionBefore[i].totalWrappedAmount).to.equal(tx.totalWrappedAmount);
        expect(confirmedTransactionBefore[i].receivers[0].amount).to.equal(tx.receivers[0].amount);
        expect(confirmedTransactionBefore[i].receivers[0].amountWrapped).to.equal(tx.receivers[0].amountWrapped);
      }
    });

    it("Should update totalAmounts in confirmedTransaction that were not yet batched", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );
      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let totalAmountsBefore = [];
      let totalWrappedAmountsBefore = [];

      for (let i = lastBatchedTxNonce + 1n; i <= lastConfirmedTxNonce; i++) {
        const tx = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );

        totalAmountsBefore[i] = tx.totalAmount;
        totalWrappedAmountsBefore[i] = tx.totalWrappedAmount;
      }

      await admin.connect(owner).pauseBridging(true);

      await admin.connect(owner).amountsTo1e18();

      for (let i = lastBatchedTxNonce + 1n; i <= lastConfirmedTxNonce; i++) {
        const tx = await claims.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          i
        );

        expect(tx.totalAmount).to.equal(BigInt(totalAmountsBefore[i]) * 1_000_000_000_000n);
        expect(tx.totalWrappedAmount).to.equal(BigInt(totalWrappedAmountsBefore[i]) * 1_000_000_000_000n);
      }
    });

    it("Should update chainTokenQuantities", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const chainTokenQuantityVBefore = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chainWrappedTokenQuantityVBefore = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await admin.connect(owner).pauseBridging(true);

      await admin.connect(owner).amountsTo1e18();

      expect(
        await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(BigInt(chainTokenQuantityVBefore) * 1_000_000_000_000n);
      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(BigInt(chainWrappedTokenQuantityVBefore) * 1_000_000_000_000n);
    });
  });

  let bridge: any;
  let claims: any;
  let chainTokens: any;
  let admin: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let validatorClaimsRRC: any;
  let validatorClaimsBEC: any;
  let validatorClaimsBEFC: any;
  let calidatorClaimsHWIC: any;
  let signedBatch: any;
  let validatorAddressChainData: any;
  let validators: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claims = fixture.claims;
    chainTokens = fixture.chainTokens;
    admin = fixture.admin;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    calidatorClaimsHWIC = fixture.validatorClaimsHWIC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
