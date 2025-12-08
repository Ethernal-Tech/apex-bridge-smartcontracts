import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Admin Functions", function () {
  describe("Chain Token Quantity", function () {
    it("Should revert if updateChainTokenQuantity is not called by fundAdmin", async function () {
      await expect(
        admin.connect(validators[0]).updateChainTokenQuantity(chain1.id, true, 100)
      ).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert if updateChainTokenQuantity in ChainTokens is not called by Admin contract", async function () {
      await expect(chainTokens.updateChainTokenQuantity(chain1.id, true, 100)).to.be.revertedWithCustomError(
        chainTokens,
        "NotAdminContract"
      );
    });

    it("Should increase chainTokenQuantity after calling updateChainTokenQuantity", async function () {
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainTokenQuantity(chain1.id, true, 100);
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(200);
    });

    it("Should increase chainTokenQuantity after calling updateChainTokenQuantity with a value higher than the current one", async function () {
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainTokenQuantity(chain1.id, true, 200);
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(300);
    });

    it("Should emit event after increasing chain token quantity with updateChainTokenQuantity", async function () {
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.updateChainTokenQuantity(chain1.id, true, 100))
        .to.emit(admin, "UpdatedChainTokenQuantity")
        .withArgs(chain1.id, true, 100);
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(200);
    });

    it("Should revert if decreae amount is higher than available chainTokenQuantity", async function () {
      await expect(admin.updateChainTokenQuantity(1, false, 200))
        .to.be.revertedWithCustomError(admin, "NegativeChainTokenAmount")
        .withArgs(100, 200);
    });

    it("Should decrease chainTokenQuantity by required amount", async function () {
      await admin.updateChainTokenQuantity(chain1.id, false, 50);

      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(50);
    });

    it("Should emit event after decreasing chain token quantity with updateChainTokenQuantity", async function () {
      await expect(admin.updateChainTokenQuantity(chain1.id, false, 50))
        .to.emit(admin, "UpdatedChainTokenQuantity")
        .withArgs(chain1.id, false, 50);
    });

    it("Should revert if updateChainWrappedTokenQuantity is not called by fundAdmin", async function () {
      await expect(
        admin.connect(validators[0]).updateChainWrappedTokenQuantity(1, true, 100)
      ).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert if updateChainWrappedTokenQuantity in ChainTokens is not called by Admin contract", async function () {
      await expect(chainTokens.updateChainWrappedTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        chainTokens,
        "NotAdminContract"
      );
    });

    it("Should increase chainWrappesTokenQuantity after calling updateChainWrappedTokenQuantity", async function () {
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainWrappedTokenQuantity(chain1.id, true, 100);
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(200);
    });

    it("Should emit event after increasing chain wrapped token quantity with updateChainWrappedTokenQuantity", async function () {
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.updateChainWrappedTokenQuantity(chain1.id, true, 100))
        .to.emit(admin, "UpdatedChainWrappedTokenQuantity")
        .withArgs(chain1.id, true, 100);

      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(200);
    });

    it("Should revert if decrese amount is higher than available chainWrappedTokenQuantity", async function () {
      await expect(admin.updateChainWrappedTokenQuantity(1, false, 200))
        .to.be.revertedWithCustomError(admin, "NegativeChainTokenAmount")
        .withArgs(100, 200);
    });

    it("Should decrease chainWrappedTokenQuantity by required amount", async function () {
      await admin.updateChainWrappedTokenQuantity(chain1.id, false, 50);

      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(50);
    });

    it("Should emit event after decreasing chain token quantity with updateChainWrappedTokenQuantity", async function () {
      await expect(admin.updateChainWrappedTokenQuantity(chain1.id, false, 50))
        .to.emit(admin, "UpdatedChainWrappedTokenQuantity")
        .withArgs(chain1.id, false, 50);
    });
  });
  describe("Setting FundAdmin", function () {
    it("Should revert setFundAdmin is not called by owner", async function () {
      await expect(admin.connect(validators[0]).setFundAdmin(validators[0])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert if FundAdmin is ZeroAddress", async function () {
      await expect(admin.setFundAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(admin, "ZeroAddress");
    });

    it("Should set fundAdmin when called by Owner", async function () {
      await admin.setFundAdmin(validators[0].address);

      expect(await admin.fundAdmin()).to.be.equal(validators[0].address);
    });

    it("Should emit ChangedFundAdmin when new fundAdmin is set ", async function () {
      await expect(await admin.setFundAdmin(validators[0].address))
        .to.emit(admin, "FundAdminChanged")
        .withArgs(validators[0].address);
    });
  });
  describe("Defund chain", function () {
    it("Should revert if defund is not called by fundAdmin", async function () {
      await admin.setFundAdmin(validators[0].address);
      await expect(admin.connect(owner).defund(1, 100, 100, [], "address")).to.be.revertedWithCustomError(
        admin,
        "NotFundAdmin"
      );
    });

    it("Should revert if defund in claims is not called by Admin Contract", async function () {
      await expect(claims.connect(owner).defund(1, 100, 100, [], "address")).to.be.revertedWithCustomError(
        claims,
        "NotAdminContract"
      );
    });

    it("Should revert when defund amount is higher then availableTokens amount", async function () {
      await admin.setFundAdmin(validators[0].address);

      await expect(admin.connect(validators[0]).defund(chain1.id, 1000, 1, [], "address"))
        .to.be.revertedWithCustomError(claims, "DefundRequestTooHigh")
        .withArgs("Defund - Currency", 1, 100, 1000);
    });

    it("Should revert when defund wrapped amount is higher then availableTokens amount", async function () {
      await admin.setFundAdmin(validators[0].address);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].tokenId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      await expect(admin.connect(validators[0]).defund(1, 1, 1000, [], "address"))
        .to.be.revertedWithCustomError(claims, "DefundRequestTooHigh")
        .withArgs("Defund - Native Token", 1, 200, 1000);
    });

    it("Should remove defund amount from availableTokens amount", async function () {
      await admin.setFundAdmin(validators[0].address);

      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
      await admin.connect(validators[0]).defund(chain1.id, 1, 1, [], "address");
      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(99);
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(99);
    });

    it("Should emit ChainDefunded when currency defund is executed", async function () {
      await admin.setFundAdmin(validators[0].address);

      await expect(await admin.connect(validators[0]).defund(chain1.id, 1, 0, [], "address"))
        .to.emit(admin, "ChainDefunded")
        .withArgs(1, 1, 0, [], "address");
    });

    it("Should emit ChainDefunded when native token defund is executed", async function () {
      await admin.setFundAdmin(validators[0].address);

      await expect(await admin.connect(validators[0]).defund(chain1.id, 0, 1, [], "address"))
        .to.emit(admin, "ChainDefunded")
        .withArgs(1, 0, 1, [], "address");
    });

    it("Should emit ChainDefunded when defund with non-wrapped token is executed", async function () {
      await admin.setFundAdmin(validators[0].address);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].tokenId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBRC);

      await expect(await admin.connect(validators[0]).defund(chain1.id, 1, 1, tokenAmounts, "address"))
        .to.emit(admin, "ChainDefunded")
        .withArgs(1, 1, 1, [[1n, 1n, 10n]], "address");
    });

    it("Should add confirmedTransactioin when defund is called", async function () {
      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain1.id, 1, 1, [], "address");

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

      await admin.connect(validators[0]).defund(chain1.id, 1, 1, [], "address");

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });

    it("Should set correct confirmedTransaction when defund is called", async function () {
      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain1.id, 1, 1, [], "address");

      expect((await claims.confirmedTransactions(chain1.id, 1)).transactionType).to.equal(1); // TransactionTypesLib.DEFUND)
      expect((await claims.confirmedTransactions(chain1.id, 1)).sourceChainId).to.equal(chain1.id);
      expect((await claims.confirmedTransactions(chain1.id, 1)).nonce).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).retryCounter).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalWrappedAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).blockHeight).to.equal(43);
    });

    it("Should set correct confirmedTransaction when defund is called with non-wrapped token", async function () {
      await admin.setFundAdmin(validators[0].address);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].tokenId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBRC);

      await admin.connect(validators[0]).defund(chain1.id, 0, 1, tokenAmounts, "address");

      expect((await claims.confirmedTransactions(chain1.id, 1)).transactionType).to.equal(1); // TransactionTypesLib.DEFUND)
      expect((await claims.confirmedTransactions(chain1.id, 1)).sourceChainId).to.equal(chain1.id);
      expect((await claims.confirmedTransactions(chain1.id, 1)).nonce).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).retryCounter).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalAmount).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalWrappedAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).blockHeight).to.equal(47);
    });

    it("Should set correct confirmedTransaction when defund is called with only colored tokens", async function () {
      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain1.id, 0, 0, tokenAmounts, "address");

      expect((await claims.confirmedTransactions(chain1.id, 1)).blockHeight).to.equal(43);
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalAmount).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalWrappedAmount).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).retryCounter).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).observedTransactionHash).to.equal(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      expect((await claims.confirmedTransactions(chain1.id, 1)).nonce).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).sourceChainId).to.equal(chain1.id);
      expect((await claims.confirmedTransactions(chain1.id, 1)).transactionType).to.equal(1); // TransactionTypesLib.DEFUND)
      expect((await claims.confirmedTransactions(chain1.id, 1)).alreadyTriedBatch).to.equal(false);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain1.id, 1)).destinationChainId).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).stakePoolId).to.equal("");
      expect((await claims.confirmedTransactions(chain1.id, 1)).bridgeAddrIndex).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).transactionSubType).to.equal(0);
      expect((await claims.getConfirmedTransaction(chain1.id, 1)).receivers.length).to.equal(1);
    });

    it("Should set correct confirmedTransaction when defund fails", async function () {
      const signedBatchDefund = structuredClone(signedBatch);
      signedBatchDefund.lastTxNonceId = 2;

      await admin.updateChainTokenQuantity(chain2.id, true, 100);
      await admin.updateChainWrappedTokenQuantity(chain2.id, true, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(1);

      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain2.id, 1, 1, [], "address");

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchDefund);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatchDefund.destinationChainId, signedBatchDefund.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatchDefund.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatchDefund.lastTxNonceId);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claims.lastBatchedTxNonce(chain2.id)).to.equal(2);
      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).sourceChainId).to.equal(chain2.id);
      expect((await claims.confirmedTransactions(chain2.id, 3)).nonce).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).retryCounter).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain2.id, 3)).totalAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain2.id, 3)).totalWrappedAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain2.id, 3)).blockHeight).to.equal(49);
    });

    it("Should set correct confirmedTransaction when defund with non-wrapped token fails", async function () {
      const signedBatchDefund = structuredClone(signedBatch);
      signedBatchDefund.lastTxNonceId = 2;

      await admin.updateChainTokenQuantity(chain2.id, true, 100);
      await admin.updateChainWrappedTokenQuantity(chain2.id, true, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(1);

      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain2.id, 0, 1, tokenAmounts, "address");

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      // wait for next timeout
      for (let i = 0; i < 8; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchDefund);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatchDefund.destinationChainId, signedBatchDefund.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatchDefund.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatchDefund.lastTxNonceId);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claims.lastBatchedTxNonce(chain2.id)).to.equal(2);
      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).sourceChainId).to.equal(chain2.id);
      expect((await claims.confirmedTransactions(chain2.id, 3)).nonce).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).retryCounter).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain2.id, 3)).totalAmount).to.equal(0);
      expect((await claims.confirmedTransactions(chain2.id, 3)).totalWrappedAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain2.id, 3)).blockHeight).to.equal(49);
    });

    it("Should reject defund after maximum number of retries", async function () {
      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain2.id, 1, 1, [], "address");

      const temp_signedBatch = structuredClone(signedBatch);

      //to avoid the need for public variable this value should be manually set to the value of MAX_NUMBER_OF_DEFUND_RETRIES
      const retryCounter = 3;

      for (let i = 0; i <= retryCounter; i++) {
        expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 1);
        expect((await claims.confirmedTransactions(chain2.id, i + 1)).retryCounter).to.equal(i);

        // wait for next timeout
        for (let i = 0; i < 8; i++) {
          await ethers.provider.send("evm_mine");
        }

        temp_signedBatch.firstTxNonceId = i + 1;
        temp_signedBatch.lastTxNonceId = i + 1;
        temp_signedBatch.id = i + 1;

        await bridge.connect(validators[0]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[1]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[2]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[3]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[4]).submitSignedBatch(temp_signedBatch);

        const temp_validatorClaimsBEFC = structuredClone(validatorClaimsBEFC);
        temp_validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = i + 1;

        await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBEFC);
        await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBEFC);
        await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBEFC);

        if (i == Number(retryCounter)) {
          await expect(await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBEFC)).to.emit(
            claimsProcessor,
            "DefundFailedAfterMultipleRetries"
          );
        } else {
          await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBEFC);

          expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 2);

          expect((await claims.confirmedTransactions(chain2.id, i + 2)).retryCounter).to.equal(i + 1);
        }
      }
    });

    it("Should reject defund with non-wrapped token after maximum number of retries", async function () {
      await admin.setFundAdmin(validators[0].address);

      const temp_signedBatch = structuredClone(signedBatch);

      await admin.connect(validators[0]).defund(chain2.id, 0, 1, tokenAmounts, "address");

      //to avoid the need for public variable this value should be manually set to the value of MAX_NUMBER_OF_DEFUND_RETRIES
      const retryCounter = 3;

      for (let i = 0; i <= retryCounter; i++) {
        expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 1);
        expect((await claims.confirmedTransactions(chain2.id, i + 1)).retryCounter).to.equal(i);

        // wait for next timeout
        for (let i = 0; i < 8; i++) {
          await ethers.provider.send("evm_mine");
        }

        temp_signedBatch.firstTxNonceId = i + 1;
        temp_signedBatch.lastTxNonceId = i + 1;
        temp_signedBatch.id = i + 1;

        await bridge.connect(validators[0]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[1]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[2]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[3]).submitSignedBatch(temp_signedBatch);
        await bridge.connect(validators[4]).submitSignedBatch(temp_signedBatch);

        const temp_validatorClaimsBEFC = structuredClone(validatorClaimsBEFC);
        temp_validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = i + 1;

        await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBEFC);
        await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBEFC);
        await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBEFC);

        if (i == Number(retryCounter)) {
          await expect(await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBEFC)).to.emit(
            claimsProcessor,
            "DefundFailedAfterMultipleRetries"
          );
        } else {
          await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBEFC);

          expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 2);

          expect((await claims.confirmedTransactions(chain2.id, i + 2)).retryCounter).to.equal(i + 1);
        }
      }
    });
  });
  // describe("Update bridge configuration", function () {
  //   it("Calling updateMaxNumberOfTransactions should revert if not called by owner", async function () {
  //     await expect(admin.connect(validators[0]).updateMaxNumberOfTransactions(1)).to.be.revertedWith(
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  //   it("Calling updateMaxNumberOfTransactions should update maxNumberOfTransactions", async function () {
  //     await admin.connect(owner).updateMaxNumberOfTransactions(4);

  //     expect(await claims.maxNumberOfTransactions()).to.equal(4);
  //   });

  //   it("Calling updateMaxNumberOfTransactions should triger UpdatedMaxNumberOfTransactions event", async function () {
  //     await expect(admin.connect(owner).updateMaxNumberOfTransactions(4))
  //       .to.emit(admin, "UpdatedMaxNumberOfTransactions")
  //       .withArgs(4);
  //   });

  //   it("Calling timeoutBlocksNumber should revert if not called by owner", async function () {
  //     await expect(admin.connect(validators[0]).updateTimeoutBlocksNumber(1)).to.be.revertedWith(
  //       "Ownable: caller is not the owner"
  //     );
  //   });

  //   it("Calling timeoutBlocksNumber should update timeoutBlocksNumber", async function () {
  //     await admin.connect(owner).updateTimeoutBlocksNumber(4);

  //     expect(await claims.timeoutBlocksNumber()).to.equal(4);
  //   });

  //   it("Calling timeoutBlocksNumber should triger UpdatgedTimeoutBlocksNumber event", async function () {
  //     await expect(admin.connect(owner).updateTimeoutBlocksNumber(4))
  //       .to.emit(admin, "UpdatedTimeoutBlocksNumber")
  //       .withArgs(4);
  //   });
  // });

  let bridge: any;
  let claimsHelper: any;
  let claims: any;
  let claimsProcessor: any;
  let chainTokens: any;
  let admin: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let validatorClaimsBEFC: any;
  let signedBatch: any;
  let validatorAddressChainData: any;
  let validators: any;
  let tokenAmounts: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    claimsProcessor = fixture.claimsProcessor;
    chainTokens = fixture.chainTokens;
    admin = fixture.admin;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    tokenAmounts = fixture.tokenAmounts;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
