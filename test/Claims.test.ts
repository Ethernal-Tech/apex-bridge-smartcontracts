import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  BatchType,
  deployBridgeFixture,
  hashBridgeRequestClaim,
  hashBatchExecutedClaim,
  hashBatchExecutionFailedClaim,
  hashRefundRequestClaim,
  hashHotWalletIncrementClaim,
} from "./fixtures";

describe("Claims Contract", function () {
  describe("Claims getters/setters", function () {
    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      await expect(claims.connect(owner).setChainRegistered(1, 100, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotRegistration"
      );
    });

    it("Claims SC setVotedOnlyIfNeededReturnQuorumReached should revert if not called by Bridge SC", async function () {
      await expect(
        claimsHelper
          .connect(owner)
          .setVotedOnlyIfNeededReturnQuorumReached(
            1,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            1
          )
      ).to.be.revertedWithCustomError(bridge, "NotClaimsProcessorOrRegistration");
    });

    it("getBatchTransactions should return txs from batch", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

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
      signedBatchConsolidation.batchType = BatchType.CONSOLIDATION;
      signedBatchConsolidation.firstTxNonceId = 0;
      signedBatchConsolidation.lastTxNonceId = 0;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_mine");
      }

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

    it("Should revert if updateNextTimeoutBlockIfNeeded is not called by ClaimsProcessor", async function () {
      await expect(claims.connect(owner).updateNextTimeoutBlockIfNeeded(1, 0)).to.be.revertedWithCustomError(
        bridge,
        "NotClaimsProcessor"
      );
    });
  });

  let bridge: any;
  let claimsHelper: any;
  let claims: any;
  let validatorsc: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let signedBatch: any;

  let validatorAddressChainData: any;
  let validators: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    validatorsc = fixture.validatorsc;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });

  async function numberOfVotes(hash: string): Promise<number> {
    let bitmap = (await claimsHelper.bitmap(hash)) as bigint;

    let votes = 0;
    while (bitmap !== 0n) {
      bitmap &= bitmap - 1n; // clear lowest set bit
      votes++;
    }

    return votes;
  }

  async function hasVoted(hash: string, _addr: string): Promise<boolean> {
    // bitmap(...) returns bigint in ethers v6
    const validatorIndex = ((await validatorsc.getValidatorIndex(_addr)) as bigint) - 1n;
    const bitmap = (await claimsHelper.bitmap(hash)) as bigint;

    return (bitmap & (1n << BigInt(validatorIndex))) !== 0n;
  }
});
