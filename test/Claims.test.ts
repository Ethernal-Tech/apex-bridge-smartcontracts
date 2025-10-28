import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployBridgeFixture,
  hashBridgeRequestClaim,
  hashBatchExecutionFailedClaim,
  hashRefundRequestClaim,
  hashBatchExecutedClaim,
  hashHotWalletIncrementClaim,
} from "./fixtures";

describe("Claims Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if there are too many receivers in BRC", async function () {
      const validatorClaimsBRC_tooManyReceivers = structuredClone(validatorClaimsBRC);
      validatorClaimsBRC_tooManyReceivers.bridgingRequestClaims[0].receivers = [
        ...Array.from({ length: 17 }, (_, i) => ({
          amount: 99 + i,
          destinationAddress: `0x123...${(i + 1).toString().padStart(8, "0")}`,
        })),
      ];
      await expect(
        bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_tooManyReceivers)
      ).to.be.revertedWithCustomError(bridge, "TooManyReceivers");
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const hash = hashBridgeRequestClaim(validatorClaimsBRC.bridgingRequestClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const hash = hashBridgeRequestClaim(validatorClaimsBRC.bridgingRequestClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip Bridging Request Claim if there is not enough bridging tokens and emit NotEnoughFunds event", async function () {
      const tokensAvailable = await claims.chainTokenQuantity(chain2.id);
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].totalAmountDst = tokensAvailable + 1n;

      const hash = hashBridgeRequestClaim(temp_validatorClaimsBRC.bridgingRequestClaims[0]);

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC))
        .to.emit(claims, "NotEnoughFunds")
        .withArgs("BRC", 0, 100);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should revert Bridging Request Claims if there are more than 32 in the array", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_bunch32);

      for (let i = 0; i < validatorClaimsBRC_bunch32.bridgingRequestClaims.length; i++) {
        const hash = hashBridgeRequestClaim(validatorClaimsBRC_bunch32.bridgingRequestClaims[i]);

        expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
      }

      await expect(
        bridge.connect(validators[1]).submitClaims(validatorClaimsBRC_bunch33)
      ).to.be.revertedWithCustomError(bridge, "TooManyClaims");
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should skip if Batch Executed Claims is already confirmed", async function () {
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const hash = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Executed Claim twice", async function () {
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      const hash = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for BEFC for the same batch", async function () {
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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Calculate BEC hash
      const hashBEC = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      // Calculate BEFC hash
      const hashBEFC = hashBatchExecutionFailedClaim(validatorClaimsBEFC.batchExecutionFailedClaims[0]);

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // Second claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for another BEC for the same batch", async function () {
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

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      const validatorClaimsBEC_another = structuredClone(validatorClaimsBEC);
      validatorClaimsBEC_another.batchExecutedClaims[0].observedTransactionHash =
        "0x7465737500000000000000000000000000000000000000000000000000000001";

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC_another);

      // Calculate BEC hash
      const hashBEC = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      // Calculate BEC_another hash
      const hashBEC_another = hashBatchExecutedClaim(validatorClaimsBEC_another.batchExecutedClaims[0]);

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEC_another);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC_another);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should skip if Batch Execution Failed Claims is already confirmed", async function () {
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const hash = hashBatchExecutionFailedClaim(validatorClaimsBEFC.batchExecutionFailedClaims[0]);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Execution Failed Claim twice", async function () {
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for BRC for the same batch", async function () {
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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Calculate BEC hash
      const hashBEC = hashBatchExecutedClaim(validatorClaimsBEC.batchExecutedClaims[0]);

      // Calculate BEFC hash
      const hashBEFC = hashBatchExecutionFailedClaim(validatorClaimsBEFC.batchExecutionFailedClaims[0]);

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for another BEFC for the same batch", async function () {
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      const validatorClaimsBEFC_another = structuredClone(validatorClaimsBEFC);
      validatorClaimsBEFC_another.batchExecutionFailedClaims[0].observedTransactionHash =
        "0x7465737400000000000000000000000000000000000000000000000000000001";

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

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC_another);

      // Calculate BEFC hash
      const hashBEFC = hashBatchExecutionFailedClaim(validatorClaimsBEFC.batchExecutionFailedClaims[0]);

      // Calculate BEFC_another hash
      const hashBEFC_another = hashBatchExecutionFailedClaim(validatorClaimsBEFC_another.batchExecutionFailedClaims[0]);

      // Verify that the hashes are different
      expect(hashBEFC).to.not.equal(hashBEFC_another);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC_another);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);
    });
  });

  describe("Submit new Refund Request Claims", function () {
    it("Should skip if Refund Request Claims is already confirmed", async function () {
      const hash = hashRefundRequestClaim(validatorClaimsRRC.refundRequestClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
      const hash = hashRefundRequestClaim(validatorClaimsRRC.refundRequestClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should emit NotEnoughFunds and skip Refund Request Claim for failed BRC on destination if there is not enough funds", async function () {
      const RRC_notEnoughFunds = structuredClone(validatorClaimsRRC);
      const tokensAvailable = await claims.chainTokenQuantity(chain2.id);

      RRC_notEnoughFunds.refundRequestClaims[0].originAmount = tokensAvailable + 1n;
      RRC_notEnoughFunds.refundRequestClaims[0].shouldDecrementHotWallet = true;

      await bridge.connect(validators[0]).submitClaims(RRC_notEnoughFunds);
      await bridge.connect(validators[1]).submitClaims(RRC_notEnoughFunds);
      await bridge.connect(validators[2]).submitClaims(RRC_notEnoughFunds);

      const tx = await bridge.connect(validators[3]).submitClaims(RRC_notEnoughFunds);
      const receipt = await tx.wait();

      const iface = new ethers.Interface([
        "event NotEnoughFunds(string claimeType, uint256 index, uint256 availableAmount)",
      ]);

      const event = receipt.logs
        .map((log: any) => {
          try {
            return iface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((log: any) => log !== null)
        .find((log: any) => log.name === "NotEnoughFunds");

      expect(event).to.not.be.undefined;
      expect(event.fragment.name).to.equal("NotEnoughFunds");
    });

    it("Should revert if refundTransactionHash is not empty in Refund Request Claims", async function () {
      const temp_validatorsClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorsClaimsRRC.refundRequestClaims[0].refundTransactionHash =
        "0x7465737400000000000000000000000000000000000000000000000000000001";

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorsClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "InvalidData"
      );
    });
  });

  describe("Submit new Hot Wallet Increment Claim", function () {
    it("Should skip if Hot Wallet Increment Claim Claim is already confirmed", async function () {
      const hash = hashHotWalletIncrementClaim(validatorClaimsHWIC.hotWalletIncrementClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);

      expect(
        await claims.hasVoted(
          "0x4ec43138854a8260f51de42ae197fcd87f5d22a6ea8499e1c0b261e1e4ffa575",
          validators[4].address
        )
      ).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsHWIC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Hot Wallet Increment Claim twice", async function () {
      const hash = hashHotWalletIncrementClaim(validatorClaimsHWIC.hotWalletIncrementClaims[0]);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should NOT increment totalQuantity if there is still no consensus on Hot Wallet Increment Claim", async function () {
      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    });

    it("Should increment totalQuantity if there is consensus on Hot Wallet Increment Claim", async function () {
      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(
        100 + validatorClaimsHWIC.hotWalletIncrementClaims[0].amount
      );
    });
  });
  describe("Claims getters/setters", function () {
    it("Should revert if Claims SC resetCurrentBatchBlock is not called by Bridge SC", async function () {
      await expect(claims.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      await expect(claims.connect(owner).setChainRegistered(1, 100)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setNextTimeoutBlock is not called by Bridge SC", async function () {
      await expect(claims.connect(owner).setNextTimeoutBlock(1, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });
    it("Claims SC setVotedOnlyIfNeededReturnQuorumReached should revert if not called by Bridge SC", async function () {
      await expect(
        claims
          .connect(owner)
          .setVotedOnlyIfNeededReturnQuorumReached(
            1,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            1
          )
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert claim submition in Claims SC if not called by bridge SC", async function () {
      await expect(claims.connect(owner).submitClaims(validatorClaimsBRC, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("getBatchTransactions should return txs from batch", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const [status, txs] = await claims.getBatchStatusAndTransactions(signedBatch.destinationChainId, signedBatch.id);
      expect(txs).to.deep.equal([
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId).toString(),
          0,
        ],
      ]);
      expect(status).to.equal(1);
    });

    it("getBatchTransactions should return empty tx if it is a consolidation batch", async function () {
      const signedBatchConsolidation = structuredClone(signedBatch);
      signedBatchConsolidation.isConsolidation = true;
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

      const [status, txs] = await claims.getBatchStatusAndTransactions(
        signedBatchConsolidation.destinationChainId,
        signedBatchConsolidation.id
      );
      expect(txs).to.deep.equal([]);
      expect(status).to.equal(1);
    });
  });

  let bridge: any;
  let claimsHelper: any;
  let claims: any;
  let signedBatches: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let validatorClaimsBRC_bunch32: any;
  let validatorClaimsBRC_bunch33: any;
  let validatorClaimsBEC: any;
  let validatorClaimsBEFC: any;
  let validatorClaimsRRC: any;
  let validatorClaimsHWIC: any;
  let signedBatch: any;

  let validatorAddressChainData: any;
  let validators: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    signedBatches = fixture.signedBatches;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBRC_bunch32 = fixture.validatorClaimsBRC_bunch32;
    validatorClaimsBRC_bunch33 = fixture.validatorClaimsBRC_bunch33;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorClaimsHWIC = fixture.validatorClaimsHWIC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
  });
});
