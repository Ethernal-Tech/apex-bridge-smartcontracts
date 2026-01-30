import hre from "hardhat";
import { expect } from "chai";
import { BatchType, deployBridgeFixture } from "./fixtures";

describe("Claims Contract", function () {
  describe("Claims getters/setters", function () {
    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      await expect(claims.connect(owner).setChainRegistered(1, 100, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotRegistration"
      );
    });

    it("getBatchTransactions should return txs from batch", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      for (let i = 0; i < 5; i++) {
        await connection.ethers.provider.send("evm_mine");
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
        await connection.ethers.provider.send("evm_mine");
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

  let bridge;
  let claimsHelper;
  let claims;
  let validatorsc;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let connection;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

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
    connection = fixture.connection;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });

  async function numberOfVotes(hash) {
    let bitmap = await claimsHelper.bitmap(hash);

    let votes = 0;
    while (bitmap !== 0n) {
      bitmap &= bitmap - 1n; // clear lowest set bit
      votes++;
    }

    return votes;
  }

  async function hasVoted(hash, _addr) {
    // bitmap(...) returns bigint in ethers v6
    const validatorIndex = (await validatorsc.getValidatorIndex(_addr)) - 1n;
    const bitmap = await claimsHelper.bitmap(hash);

    return (bitmap & (1n << BigInt(validatorIndex))) !== 0n;
  }
});
