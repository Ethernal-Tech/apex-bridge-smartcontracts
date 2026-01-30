import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Chain Tokens", function () {
  describe("BRC Tokens Quantity Validations", function () {
    it("Should emit NotEnoughFunds for currency with insufficient token quantity", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 200;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination = 0;

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC))
        .to.emit(chainTokens, "NotEnoughFunds")
        .withArgs("BRC - Currency", 0, 100);
    });

    it("Should emit NotEnoughFunds for wrapped token with insufficient balance", async function () {
      const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
      temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 10;
      temp_validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination = 200;

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC))
        .to.emit(chainTokens, "NotEnoughFunds")
        .withArgs("BRC - Native Token", 0, 100);
    });
  });

  describe("RRC Tokens Quantity Validations", function () {
    it("Should emit NotEnoughFunds for currency with insufficient token quantity", async function () {
      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      temp_validatorClaimsRRC.refundRequestClaims[0].originAmount = 200;
      temp_validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount = 0;

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC))
        .to.emit(chainTokens, "NotEnoughFunds")
        .withArgs("RRC - Currency", 0, 100);
    });

    it("Should emit NotEnoughFunds for wrapped token with insufficient balance", async function () {
      const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
      temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      temp_validatorClaimsRRC.refundRequestClaims[0].originAmount = 10;
      temp_validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount = 200;

      await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC))
        .to.emit(chainTokens, "NotEnoughFunds")
        .withArgs("RRC - Native Token", 0, 100);
    });
  });

  describe("Defund Tokens Quantity Validations", function () {
    it("Should revert with DefundRequestTooHigh error for currency with insufficient token quantity", async function () {
      await admin.setFundAdmin(validators[0].address);
      const amount = 101;

      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.connect(validators[0]).defund(chain1.id, amount, 0, [], "address"))
        .to.be.revertedWithCustomError(chainTokens, "DefundRequestTooHigh")
        .withArgs("Defund - Currency", chain1.id, 100, amount);
    });

    it("Should revert with DefundRequestTooHigh error for wrapped token with insufficient balance", async function () {
      await admin.setFundAdmin(validators[0].address);
      const amount = 101;

      expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
      expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.connect(validators[0]).defund(chain1.id, 0, amount, [], "address"))
        .to.be.revertedWithCustomError(chainTokens, "DefundRequestTooHigh")
        .withArgs("Defund - Native Token", chain1.id, 100, amount);
    });
  });

  let bridge;
  let claimsHelper;
  let chainTokens;
  let claims;
  let admin;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let validatorClaimsBEC;
  let validatorClaimsBEFC;
  let validatorClaimsRRC;
  let validatorClaimsHWIC;
  let signedBatch;
  let validatorAddressChainData;
  let validators;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    chainTokens = fixture.chainTokens;
    claims = fixture.claims;
    admin = fixture.admin;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsBEC = fixture.validatorClaimsBEC;
    validatorClaimsBEFC = fixture.validatorClaimsBEFC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorClaimsHWIC = fixture.validatorClaimsHWIC;
    signedBatch = fixture.signedBatch;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
