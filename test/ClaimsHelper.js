import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures.js";

describe("ClaimsHelper Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by Claims SC", async function () {
      await expect(claimsHelper.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by SignedBatches SC or Claims SC", async function () {
      await expect(claimsHelper.connect(owner).setConfirmedSignedBatchData(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotSignedBatchesOrClaims"
      );
    });

    it("Should revert if ClaimsHelper SC setVotedOnlyIfNeededReturnQuorumReached is not called by SignedBatches SC or Claims SC", async function () {
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

  let bridge;
  let claimsHelper;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBEFC;
  let signedBatch;
  let validatorAddressChainData;

  beforeEach(async function () {
    const fixture = await deployBridgeFixture();

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
  });
});
