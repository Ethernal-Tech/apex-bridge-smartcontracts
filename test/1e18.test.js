import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Convert 1e6 to 1e18", function () {
  describe("Convert 1e6 to 1e18", function () {
    it("Should revert if amountsTo1e18 is not called by fundAdmin", async function () {
      await expect(admin.connect(validators[0]).amountsTo1e18()).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert if amountsTo1e18 on chainTokens is not called by admin contract", async function () {
      await expect(chainTokens.connect(validators[0]).amountsTo1e18()).to.be.revertedWithCustomError(
        admin,
        "NotAdminContract"
      );
    });

    it("Should revert if migrateReceiverAmountsTo1e18 is not called by admin chainTokens contract", async function () {
      const chains = [chain1, chain2];
      await expect(claims.connect(validators[0]).migrateReceiverAmountsTo1e18(chains)).to.be.revertedWithCustomError(
        admin,
        "NotChainTokensContract"
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

    it("Should NOT update receivers in confirmedTransaction that WERE batched", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await connection.ethers.provider.send("evm_mine");
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

      await admin.connect(owner).amountsTo1e18();

      expect(
        await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(BigInt(chainTokenQuantityVBefore) * 1_000_000_000_000n);
      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(BigInt(chainWrappedTokenQuantityVBefore) * 1_000_000_000_000n);
    });

    it("Should emit AmountsConvertedTo1e18Done() when conversion is done", async function () {
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

      expect(await admin.connect(owner).amountsTo1e18()).to.emit(admin, "AmountsConvertedTo1e18Done");
    });
  });

  let bridge;
  let claims;
  let chainTokens;
  let admin;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let validatorClaimsRRC;
  let validatorClaimsBEC;
  let validatorClaimsBEFC;
  let validatorClaimsHWIC;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let connection;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

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
    validatorClaimsHWIC = fixture.validatorClaimsHWIC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    connection = fixture.connection;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
