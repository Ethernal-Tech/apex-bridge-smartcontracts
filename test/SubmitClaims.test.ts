import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployBridgeFixture,
  BatchType,
  TransactionType,
  TransactionSubType,
  hashBridgeRequestClaim,
  hashBatchExecutedClaim,
  hashRefundRequestClaim,
  hashBatchExecutionFailedClaim,
} from "./fixtures";

describe("Submit Claims", function () {
  const stakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";

  describe("Submit new Bridging Request Claim", function () {
    it("Should revert any claim if not sent by validator", async function () {
      await expect(bridge.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should increase lastConfirmedTxNonce when Bridging Request Claim is confirmed", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(0);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(1);
    });

    it("Should store new confirmedTransactions when Bridging Request Claim is confirmed", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const destinationChainId = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
      const nonce = await claims.lastConfirmedTxNonce(destinationChainId);

      expect((await claims.confirmedTransactions(destinationChainId, nonce)).observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).sourceChainId).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).nonce).to.equal(nonce);
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalAmount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalWrappedAmount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).coloredCoinId).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );
    });

    it("Should store new confirmedTransactions when Bridging Request Claim for coloredCoin is confirmed", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount = 0;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      const destinationChainId = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
      const nonce = await claims.lastConfirmedTxNonce(destinationChainId);

      expect((await claims.confirmedTransactions(destinationChainId, nonce)).observedTransactionHash).to.equal(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).sourceChainId).to.equal(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).nonce).to.equal(nonce);
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalAmount).to.equal(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalWrappedAmount).to.equal(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).coloredCoinId).to.equal(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );
    });

    it("Should set voted on Bridging Request Claim", async function () {
      const hash = hashBridgeRequestClaim(validatorClaimsBRC.bridgingRequestClaims[0]);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should update next timeout block when Bridging Request Claim is confirmed and requirements are met", async function () {
      const timeoutBlocksNumber = 5;
      let currentBlock = await ethers.provider.getBlockNumber();
      expect(currentBlock).to.equal(33);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      const currentBlock1 = await ethers.provider.getBlockNumber();

      expect(currentBlock1).to.equal(36);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        currentBlock + timeoutBlocksNumber
      );

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      currentBlock = await ethers.provider.getBlockNumber();
      expect(currentBlock).to.equal(40);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        currentBlock + timeoutBlocksNumber
      );
    });

    it("Should add requred amount of tokens on source chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(200);
    });

    it("Should add requred amount of wrapped tokens on source chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(100);
      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(200);
    });

    it("Should NOT add requred amount of coloredCoins on source chain when Bridging Request Claim for coloredCoins originating on source is confirmed and it is NOT a retry and coloredCoin is NOT registered", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount = 0;

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);
    });

    it("Should NOT add wrappedAmount of tokens on source chain when Bridging Request Claim for coloredCoins originating on destination is confirmed and it is NOT a retry", async function () {
      const temp_coloredCoin = structuredClone(coloredCoin);
      temp_coloredCoin.chainId = 2;
      await bridge.connect(owner).registerColoredCoin(temp_coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource = 0;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount = 0;

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);
    });

    it("Should add requred amount of coloredCoins on source chain when Bridging Request Claim for coloredCoins originating on source is confirmed and it is NOT a retry", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount = 0;

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(100);
    });

    it("Should remove requred amount of tokens from destination chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        0
      );
    });

    it("Should remove requred amount of wrappedTokens from destination chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(0);
    });

    it("Should NOT remove amount of currency Tokens from destination chain when Bridging Request Claim is confirmed and coloredCoinId != 0 and it is NOT a retry", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      expect(await chainTokens.chainTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        100
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(100);
    });

    it("Should remove requred amount of coloredCoins from destination chain when Bridging Request Claim is confirmed and coloredCoin is registerd on destination and it is NOT a retry", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(100);

      const temp_validatorClaimsBRC2 = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC2.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainId = 2;
      temp_validatorClaimsBRC2.bridgingRequestClaims[0].destinationChainId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC2);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC2.bridgingRequestClaims[0].destinationChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(0);
    });

    it("Should NOT add requred amount of tokens on source chain when Bridging Request Claim is confirmed and it is a retry", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].retryCounter = 1;

      expect(await chainTokens.chainTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        100
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(await chainTokens.chainTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        100
      );
    });

    it("Should NOT add requred amount of wrappedTokens on source chain when Bridging Request Claim is confirmed and it is a retry", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].retryCounter = 1;

      expect(
        await chainTokens.chainWrappedTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainWrappedTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(100);
    });

    it("Should NOT add requred amount of coloredCoins on source chain when Bridging Request Claim is confirmed and it is a retry", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      const temp_validatorClaimsBRC2 = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC2.bridgingRequestClaims[0].retryCounter = 1;
      temp_validatorClaimsBRC2.bridgingRequestClaims[0].coloredCoinId = 1;

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC2.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC2);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          temp_validatorClaimsBRC2.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.equal(100);
    });

    it("Should update nextTimeoutBlock when Bridging Request Claim is confirmed and conditions are met", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[4]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId);
      expect(confBatch.bitmap).to.equal(27);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should set voted on Bridging Executed Claim", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const hash = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should set status executed for confirmed signed batch after reaching quorum on Bridging Executed Claim", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confSignedBatchDataPrev = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEC.batchExecutedClaims[0].chainId,
        validatorClaimsBEC.batchExecutedClaims[0].batchNonceId
      );
      expect(confSignedBatchDataPrev.firstTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.lastTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.status).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const confSignedBatchData = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEC.batchExecutedClaims[0].chainId,
        validatorClaimsBEC.batchExecutedClaims[0].batchNonceId
      );
      expect(confSignedBatchData.firstTxNonceId).to.equal(1);
      expect(confSignedBatchData.lastTxNonceId).to.equal(1);
      expect(confSignedBatchData.status).to.equal(2);
    });

    it("Should set status failed for confirmed signed batch after reaching quorum on Bridging Executed Claim", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confSignedBatchDataPrev = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId
      );
      expect(confSignedBatchDataPrev.firstTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.lastTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.status).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const confSignedBatchData = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId
      );
      expect(confSignedBatchData.firstTxNonceId).to.equal(1);
      expect(confSignedBatchData.lastTxNonceId).to.equal(1);
      expect(confSignedBatchData.status).to.equal(3);
    });

    it("Should update lastBatchedTxNonce when Bridging Executed Claim is confirmed", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId);
      expect(confBatch.bitmap).to.equal(15);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      const lastNonceBefore = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonceBefore).to.equal(0);

      // quorum reached!
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastNonce = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonce).to.equal(1);
    });

    it("Should reset currentBatchBlock when Bridging Executed Claim is confirmed", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Claim is confirmed", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should not update nextTimeoutBlock when Bridging Excuted Claim contains a consolidation batch", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      const signedBatchConsolidation = structuredClone(signedBatch);
      signedBatchConsolidation.batchType = BatchType.CONSOLIDATION;
      signedBatchConsolidation.firstTxNonceId = 0;
      signedBatchConsolidation.lastTxNonceId = 0;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.lessThan(currentBlock);
    });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should set voted on Bridging Execution Failed Claim", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const hash = hashBatchExecutionFailedClaim(validatorClaimsBEFC.batchExecutionFailedClaims[0]);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should reset currentBatchBlock when Bridging Executed Failed Claim is confirmed", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Failed Claim is confirmed", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should not update nextTimeoutBlock when Bridging Excuted Failed Claim containis consolidation batch", async function () {
      const signedBatchConsolidation = structuredClone(signedBatch);
      signedBatchConsolidation.batchType = BatchType.CONSOLIDATION;
      signedBatchConsolidation.firstTxNonceId = 0;
      signedBatchConsolidation.lastTxNonceId = 0;

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.lessThan(currentBlock);
    });

    it("Should update lastBatchedTxNonce when Bridging Excuted Failed Claim is confirmed", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claims.lastBatchedTxNonce(_destinationChain)).to.equal(0);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.lastBatchedTxNonce(_destinationChain)).to.equal(1);
    });

    it("Should increase chainTokenQuantity and chainWrappedTokenQuantity for destination chain when Bridging Excuted Failed Claim is confirmed", async function () {
      const chain2TokenQuantityStart = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityStart = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(
        chain2TokenQuantityStart - BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(
        chain2WrappedTokenQuantityStart - BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      // wait for next timeout
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const chain2TokenQuantityAfter = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityAfter = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      expect(chain2TokenQuantityAfter).to.be.equal(chain2TokenQuantityStart);

      expect(chain2WrappedTokenQuantityAfter).to.be.equal(chain2WrappedTokenQuantityStart);
    });

    it("Should increase chainWrappedTokenQuantity and should NOT increase chainTokenQuantity for destination chain when Bridging Excuted Failed Claim is confirmed and coloredCoinId != 0", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      const chain2TokenQuantityStart = await chainTokens.chainTokenQuantity(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityStart = await chainTokens.chainWrappedTokenQuantity(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(chain2TokenQuantityStart);

      expect(
        await chainTokens.chainWrappedTokenQuantity(temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(
        chain2WrappedTokenQuantityStart -
        BigInt(temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      // wait for next timeout
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const temp = await claimsHelper.getConfirmedSignedBatchData(2, 1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const chain2TokenQuantityAfter = await chainTokens.chainTokenQuantity(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId
      );

      const chain2WrappedTokenQuantityAfter = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId
      );

      expect(chain2TokenQuantityAfter).to.be.equal(chain2TokenQuantityStart);
      expect(chain2WrappedTokenQuantityAfter).to.be.equal(chain2WrappedTokenQuantityAfter);
    });

    it("Should increase coloredCoinQuantity for destination chain when Bridging Excuted Failed Claim is confirmed and destination is the source of coloredCoin", async function () {
      const temp_coloredCoin = structuredClone(coloredCoin);
      temp_coloredCoin.chainId = chain2.id;

      await bridge.connect(owner).registerColoredCoin(temp_coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      const chain2ColoredCoinQuantityStart = await chainTokens.chainColoredCoinQuantity(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
        )
      ).to.be.equal(chain2ColoredCoinQuantityStart);

      // wait for next timeout
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const chain2ColoredCoinQuantityAfter = await chainTokens.chainColoredCoinQuantity(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );

      expect(chain2ColoredCoinQuantityAfter).to.be.equal(chain2ColoredCoinQuantityStart);
    });
  });

  describe("Submit new Refund Request Claims", function () {
    it("Should set voted on Refund Request Claim", async function () {
      const hash = hashRefundRequestClaim(validatorClaimsRRC.refundRequestClaims[0]);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);
      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should store new confirmedTransactions when Refund Request Claim is confirmed", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      const chainID = validatorClaimsRRC.refundRequestClaims[0].originChainId;

      const nonce = await claims.lastConfirmedTxNonce(chainID);

      expect((await claims.confirmedTransactions(chainID, nonce)).sourceChainId).to.equal(
        validatorClaimsRRC.refundRequestClaims[0].originChainId
      );
      expect((await claims.confirmedTransactions(chainID, nonce)).nonce).to.equal(nonce);
      expect((await claims.confirmedTransactions(chainID, nonce)).outputIndexes).to.equal(
        validatorClaimsRRC.refundRequestClaims[0].outputIndexes
      );
      expect((await claims.confirmedTransactions(chainID, nonce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
    });

    it("Should not change Hot Wallet status when Refund Request Claims is confirmed (wrong metadata, not enough funds)", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const hotWalletState = await chainTokens.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        hotWalletState
      );
    });

    it("Should decrease Hot Wallet status when Refund Request Claims has shouldDecrementHotWallet set to true and it is 0 retry", async function () {
      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;

      const chainTokenQuantityBefore = await chainTokens.chainTokenQuantity(
        temp_validatorClaimsRRC.refundRequestClaims[0].originChainId
      );

      const chainWrappedTokenQuantityBefore = await chainTokens.chainWrappedTokenQuantity(
        temp_validatorClaimsRRC.refundRequestClaims[0].originChainId
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(temp_validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        chainTokenQuantityBefore - BigInt(temp_validatorClaimsRRC.refundRequestClaims[0].originAmount)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(temp_validatorClaimsRRC.refundRequestClaims[0].originChainId)
      ).to.equal(
        chainWrappedTokenQuantityBefore - BigInt(temp_validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount)
      );
    });

    it("Should NOT decrease Hot Wallet status for currency when Refund Request Claims has shouldDecrementHotWallet set to true, it is 0 retry and coloredCoinId != 0", async function () {
      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId = 1;

      const temp_coloredCoin = structuredClone(coloredCoin);
      temp_coloredCoin.chainId = temp_validatorClaimsRRC.refundRequestClaims[0].originChainId;
      await bridge.connect(owner).registerColoredCoin(temp_coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId = 1;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId =
        temp_validatorClaimsRRC.refundRequestClaims[0].originChainId;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      const chainTokenQuantityBefore = await chainTokens.chainTokenQuantity(
        temp_validatorClaimsRRC.refundRequestClaims[0].originChainId
      );

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(temp_validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        chainTokenQuantityBefore
      );
    });

    it("Should NOT decrease Hot Wallet status when Refund Request Claims has shouldDecrementHotWallet set to true and it is NOT 0 retry", async function () {
      const RRC_clone = structuredClone(validatorClaimsRRC);
      RRC_clone.refundRequestClaims[0].shouldDecrementHotWallet = true;
      RRC_clone.refundRequestClaims[0].retryCounter = 1;

      await bridge.connect(validators[0]).submitClaims(RRC_clone);
      await bridge.connect(validators[1]).submitClaims(RRC_clone);
      await bridge.connect(validators[2]).submitClaims(RRC_clone);

      const hotWalletState = await chainTokens.chainTokenQuantity(RRC_clone.refundRequestClaims[0].originChainId);

      await bridge.connect(validators[3]).submitClaims(RRC_clone);

      expect(await chainTokens.chainTokenQuantity(RRC_clone.refundRequestClaims[0].originChainId)).to.equal(hotWalletState);
    });

    it("Should decrease Hot Wallet status for coloredCoins when Refund Request Claims has shouldDecrementHotWallet set to true and it is 0 retry and coloredCoinId != 0", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      const chainColoredCoinQuantityBefore = await chainTokens.chainColoredCoinQuantity(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );

      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId = 1;
      temp_validatorClaimsRRC.refundRequestClaims[0].originChainId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsRRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsRRC.refundRequestClaims[0].originChainId,
          temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId
        )
      ).to.equal(chainColoredCoinQuantityBefore - BigInt(temp_validatorClaimsRRC.refundRequestClaims[0].originAmount));
    });

    it("Should NOT decrease Hot Wallet status for coloredCoins when Refund Request Claims has shouldDecrementHotWallet set to true and it is NOT 0 retry and coloredCoinId != 0", async function () {
      const temp_coloredCoin = structuredClone(coloredCoin);
      temp_coloredCoin.chainId = chain2.id;
      await bridge.connect(owner).registerColoredCoin(temp_coloredCoin);

      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsBRC);

      const chainColoredCoinQuantityBefore = await chainTokens.chainColoredCoinQuantity(
        temp_validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
        temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId
      );

      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      temp_validatorClaimsRRC.refundRequestClaims[0].retryCounter = 1;
      temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId = 1;

      await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(temp_validatorClaimsRRC);

      expect(
        await chainTokens.chainColoredCoinQuantity(
          temp_validatorClaimsRRC.refundRequestClaims[0].originChainId,
          temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId
        )
      ).to.equal(chainColoredCoinQuantityBefore);
    });

    it("Use Case 1: BRC -> BEFC -> RRC", async function () {
      let hotWalletStateOriginalSource = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletWrappedStateOriginalSource = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletStateOriginalDestination = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let hotWalletWrappedStateOriginalDestination = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination -
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalDestination -
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination)
      );

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(hotWalletWrappedStateOriginalDestination);

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain2.id;
    });

    it("Use Case 2: BRC -> BEFC -> RRC -> BEFC -> RRC -> BEFC", async function () {
      let hotWalletStateOriginalSource = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletWrappedStateOriginalSource = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletStateOriginalDestination = await chainTokens.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let hotWalletWrappedStateOriginalDestination = await chainTokens.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      // --- START BRC ---

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination -
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalDestination -
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination)
      );

      // --- END BRC ---

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 1 ---

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
        BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      expect(
        await chainTokens.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(hotWalletWrappedStateOriginalDestination);

      // --- END BEFC 1 ---

      // --- START RRC 1 ---

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END RRC 1 ---

      signedBatch.id = 1;
      signedBatch.firstTxNonceId = 1;
      signedBatch.lastTxNonceId = 1;
      signedBatch.destinationChainId = chain1.id;

      // wait for next timeout
      for (let i = 0; i < 4; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 2 ---

      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 2;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 1;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END BEFC 2 ---

      // --- START RRC 2 ---

      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 1;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END RRC 2 ---

      signedBatch.id = 2;
      signedBatch.firstTxNonceId = 2;
      signedBatch.lastTxNonceId = 2;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 3 ---

      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 2;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await chainTokens.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END BEFC 3 ---

      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain2.id;
      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 0;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 1;
      signedBatch.id = 1;
      signedBatch.firstTxNonceId = 1;
      signedBatch.lastTxNonceId = 1;
    });
  });

  describe("Submit new Stake Delegation Batch Executed Claims", function () {
    it("Should not create batch when no unbatched txs exist", async function () {
      const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
      signedBatchStakeDelOrRedistr.destinationChainId = 1;

      await admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      validatorClaimsBEC.batchExecutedClaims[0].chainId = chain1.id;
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEC);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(1);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(0);
    });
  });

  describe("Submit new Redistribute Tokens Batch Executed Claims", function () {
    it("Should successfully submit redistribute batch after timeout expires", async function () {
      const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
      signedBatchStakeDelOrRedistr.destinationChainId = 1;

      await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      validatorClaimsBEC.batchExecutedClaims[0].chainId = chain1.id;
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEC);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(1);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(0);
    });

    it("Should return token redistribution txs if previous batch failed", async function () {
      await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

      const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
      signedBatchStakeDelOrRedistr.destinationChainId = 1;

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(0);

      validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEFC);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(1);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);

      // wait for next timeout (current timeout is 5 blocks)
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

      const confirmedTxs = await bridge.getConfirmedTransactions(chain1.id);
      expect(confirmedTxs.length).to.equal(1);

      expect(confirmedTxs[0].destinationChainId).to.equal(chain1.id);
      expect(confirmedTxs[0].nonce).to.equal(2);
      expect(confirmedTxs[0].transactionType).to.equal(TransactionType.REDISTRIBUTION);
      expect(confirmedTxs[0].retryCounter).to.equal(1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });
  });

  describe("Submit new Stake Delegation Batch Execution Failed Claims", function () {
    it("Should return stake delegation txs if previous batch failed", async function () {
      const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
      signedBatchStakeDelOrRedistr.destinationChainId = 1;

      await admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(0);

      validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEFC);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(1);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);

      // wait for next timeout (current timeout is 5 blocks)
      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

      const confirmedTxs = await bridge.getConfirmedTransactions(chain1.id);
      expect(confirmedTxs.length).to.equal(1);

      expect(confirmedTxs[0].destinationChainId).to.equal(chain1.id);
      expect(confirmedTxs[0].stakePoolId).to.equal(stakePoolId);
      expect(confirmedTxs[0].bridgeAddrIndex).to.equal(bridgeAddrIndex);
      expect(confirmedTxs[0].nonce).to.equal(2);
      expect(confirmedTxs[0].transactionType).to.equal(TransactionType.STAKE);
      expect(confirmedTxs[0].transactionSubType).to.equal(TransactionSubType.STAKE_REGISTRATION);
      expect(confirmedTxs[0].retryCounter).to.equal(1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });

    it("Should revert after batch execution failed more than 3 times", async function () {
      const signedBatchStakeDelOrRedistr = structuredClone(signedBatch);
      signedBatchStakeDelOrRedistr.destinationChainId = 1;

      await admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

      const mineBlocks = async (count: number) => {
        for (let i = 0; i < count; i++) {
          await ethers.provider.send("evm_mine");
        }
      };

      const submitFailedBatch = async () => {
        const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(chain1.id);
        signedBatchStakeDelOrRedistr.firstTxNonceId = lastConfirmedTxNonce;
        signedBatchStakeDelOrRedistr.lastTxNonceId = lastConfirmedTxNonce;

        const batchId = (await signedBatches.getConfirmedBatchId(chain1.id)) + 1n;
        signedBatchStakeDelOrRedistr.id = batchId;

        for (const v of validators.slice(0, 4)) {
          await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
        }

        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;
        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

        for (const v of validators.slice(0, 4)) {
          await bridge.connect(v).submitClaims(validatorClaimsBEFC);
        }
      };

      // Initial failed batch
      await mineBlocks(3);
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;
      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEFC);
      }

      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(1);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);

      // Second failure
      await mineBlocks(5);
      await submitFailedBatch();
      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(2);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);

      // Third failure
      await mineBlocks(5);
      await submitFailedBatch();
      expect(await claims.lastBatchedTxNonce(chain1.id)).to.equal(3);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);

      // Fourth failure (should now trigger StakeDelegationFailedAfterMultipleRetries)
      await mineBlocks(5);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(chain1.id);
      signedBatchStakeDelOrRedistr.firstTxNonceId = lastConfirmedTxNonce;
      signedBatchStakeDelOrRedistr.lastTxNonceId = lastConfirmedTxNonce;

      const lastBatchNonce = (await signedBatches.getConfirmedBatchId(chain1.id)) + 1n;
      signedBatchStakeDelOrRedistr.id = lastBatchNonce;

      for (const v of validators.slice(0, 4)) {
        await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
      }

      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = lastBatchNonce;

      for (const v of validators.slice(0, 3)) {
        await bridge.connect(v).submitClaims(validatorClaimsBEFC);
      }

      await expect(bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC)).to.emit(
        claims,
        "StakeOperationFailedAfterMultipleRetries"
      );

      // Expect batching state reset
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(0);
      expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.false;

      // Re-delegate to verify delegation is now allowed again
      await admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);
      expect(await claims.getBatchingTxsCount(chain1.id)).to.equal(1);
    });
  });

  let admin: any;
  let bridge: any;
  let bridgingAddresses: any;
  let claimsHelper: any;
  let claims: any;
  let chainTokens: any;
  let signedBatches: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let validatorClaimsBEC: any;
  let validatorClaimsBEFC: any;
  let validatorClaimsRRC: any;
  let signedBatch: any;
  let validatorAddressChainData: any;
  let validators: any;
  let bridgeAddrIndex: any;
  let coloredCoin: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    admin = fixture.admin;
    bridge = fixture.bridge;
    bridgingAddresses = fixture.bridgingAddresses;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    chainTokens = fixture.chainTokens;
    signedBatches = fixture.signedBatches;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    bridgeAddrIndex = fixture.bridgeAddrIndex;
    coloredCoin = fixture.coloredCoin;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
