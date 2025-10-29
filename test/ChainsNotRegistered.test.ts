import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { TransactionSubType, deployBridgeFixture } from "./fixtures";

describe("Unregistered Chains Contract", function () {
  it("Should revert submit BRC if either source and destination chains are not registered", async function () {
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
    await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);
  });

  it("Should revert submit BEC if chain is not registered", async function () {
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC))
      .to.be.revertedWithCustomError(claimsHelper, "ChainIsNotRegistered")
      .withArgs(validatorClaimsBEC.batchExecutedClaims[0].chainId);
  });

  it("Should revert submit BEFC if chain is not registered", async function () {
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId);
  });

  it("Should revert submit RRC if chain is not registered", async function () {
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(validatorClaimsRRC.refundRequestClaims[0].originChainId);
  });

  it("Should revert submit HWIC if chain is not registered", async function () {
    await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId);
  });

  it("Should revert if updateChainTokenQuantity is called on unregistered chain", async function () {
    await expect(admin.updateChainTokenQuantity(1, true, 100))
      .to.be.revertedWithCustomError(claims, "ChainIsNotRegistered")
      .withArgs(1);
  });

  it("Should revert if updateChainWrappedTokenQuantity is called on unregistered chain", async function () {
    await expect(admin.updateChainWrappedTokenQuantity(1, true, 100))
      .to.be.revertedWithCustomError(claims, "ChainIsNotRegistered")
      .withArgs(1);
  });

  it("Should revert if submitLastObservedBlocks is called on unregistered chain", async function () {
    await expect(bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks))
      .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered")
      .withArgs(1);
  });

  it("Should revert if defund is called on unregistered chain", async function () {
    await admin.setFundAdmin(validators[0].address);
    await expect(admin.connect(validators[0]).defund(1, 100, 100, 0, "address"))
      .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered")
      .withArgs(1);
  });

  it("Should revert stakeAddressOperation for stake registration if chain is not registered", async () => {
    await expect(
      admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION)
    ).to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
  });

  it("Should revert stakeAddressOperation fir stake deregistrationif chain is not registered", async () => {
    await expect(
      admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION)
    ).to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
  });

  it("Should revert stakeAddressOperation for stake delegation if chain is not registered", async () => {
    await expect(
      admin
        .connect(owner)
        .stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION)
    ).to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
  });

  it("Should revert redistributeBridgingAddrsTokens if chain is not registered", async () => {
    await expect(admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id)).to.be.revertedWithCustomError(
      admin,
      "ChainIsNotRegistered"
    );
  });

  it("Should revert if same validator votes twice for the same chain", async function () {
    await bridge
      .connect(validators[0])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        100,
        validatorAddressChainData[0].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );

    await expect(
      bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        )
    ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
  });

  it("Performance for registerChain", async function () {
    const { bridge, chain1, owner, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

    const tx = await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    const receipt = await tx.wait();
    console.log(`Gas spent: ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
  });

  it("Performance for registerChainGovernance", async function () {
    const { bridge, chain1, validators, validatorCardanoData } = await loadFixture(deployBridgeFixture);

    for (let i = 0; i < (validators.length * 2) / 3 + 1; i++) {
      // fourth one is quorum
      const tx = await bridge
        .connect(validators[i])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          100,
          validatorCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      const receipt = await tx.wait();
      console.log(`Gas spent on (${i}): ${!!receipt ? receipt.gasUsed.toString() : "error"}`);
    }
  });

  const stakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";
  const invalidStakePoolId = "";

  let bridge: any;
  let admin: any;
  let claims: any;
  let claimsHelper: any;
  let owner: any;
  let chain1: any;
  let validatorClaimsBRC: any;
  let validatorClaimsBEC: any;
  let validatorClaimsBEFC: any;
  let validatorClaimsRRC: any;
  let validatorClaimsHWIC: any;
  let validatorAddressChainData: any;
  let validators: any;
  let bridgeAddrIndex: any;
  let cardanoBlocks: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    admin = fixture.admin;
    bridge = fixture.bridge;
    claims = fixture.claims;
    claimsHelper = fixture.claimsHelper;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorClaimsHWIC = fixture.validatorClaimsHWIC;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    cardanoBlocks = fixture.cardanoBlocks;
    bridgeAddrIndex = fixture.bridgeAddrIndex;
  });
});
