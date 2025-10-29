import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("ClaimsHelper Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by Claims SC", async function () {
      await expect(claimsHelper.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaimsOrClaimsProcessor"
      );
    });

    it("Should revert if ClaimsHelper SC setConfirmedSignedBatchData is not called by SignedBatches SC or Claims SC", async function () {
      await expect(claimsHelper.connect(owner).setConfirmedSignedBatchData(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotSignedBatches"
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
      ).to.be.revertedWithCustomError(bridge, "NotClaimsProcessorOrRegistration");
    });
  });

  let bridge: any;
  let claimsHelper: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBEFC: any;
  let signedBatch: any;
  let validatorAddressChainData: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
