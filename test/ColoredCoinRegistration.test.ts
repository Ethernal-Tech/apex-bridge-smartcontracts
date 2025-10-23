import { Chain } from "./../node_modules/fp-ts/es6/Chain.d";
import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Colored Coins", function () {
  describe("Register colored coin by owner", function () {
    it("Should revert if registerColoredCoin is not called by the owner", async function () {
      await expect(bridge.connect(validators[0]).registerColoredCoin(coloredCoin)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert if registerColoredCoin if coin id is zero", async function () {
      const temp_coloredCoin = structuredClone(coloredCoin);
      temp_coloredCoin.coloredCoinId = 0;
      await expect(bridge.connect(owner).registerColoredCoin(temp_coloredCoin))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("coloredCoinId is zero");
    });

    it("Should revert if registerColoredCoin if coin is already registered", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);

      await expect(bridge.connect(owner).registerColoredCoin(coloredCoin))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("coloredCoinId is already registered");
    });

    it("Should revert if registerColoredCoin in claims is not called by Bridge SC", async function () {
      await expect(chainTokens.connect(owner).registerColoredCoin(coloredCoin)).to.be.revertedWithCustomError(
        claims,
        "NotRegistration"
      );
    });

    it("Should set isRegistered if registerColoredCoin is successfull", async function () {
      await bridge.connect(owner).registerColoredCoin(coloredCoin);

      expect(await chainTokens.coloredCoinToChain(coloredCoin.coloredCoinId)).to.be.equal(coloredCoin.chainId);
    });

    it("Should emit newColoredCoinRegistered when coloredCoin is registered", async function () {
      expect(await bridge.connect(owner).registerColoredCoin(coloredCoin))
        .to.emit(bridge, "newColoredCoinRegistered")
        .withArgs(coloredCoin.chainId, coloredCoin.coloredCoinId);
    });
  });
  describe("Register colored coin by governance", function () {
    it("Should revert if registerColoredCoin is not called by validator", async function () {
      await expect(bridge.connect(owner).registerColoredCoinGovernance(coloredCoin)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should emit newColoredCoinProposed when coloredCoin is proposed", async function () {
      expect(await bridge.connect(validators[0]).registerColoredCoinGovernance(coloredCoin))
        .to.emit(bridge, "newColoredCoinProposed")
        .withArgs(coloredCoin.chainId, coloredCoin.coloredCoinId);
    });

    it("Should set isRegistered if registerColoredCoin is successfull", async function () {
      await bridge.connect(validators[0]).registerColoredCoinGovernance(coloredCoin);
      await bridge.connect(validators[1]).registerColoredCoinGovernance(coloredCoin);
      await bridge.connect(validators[2]).registerColoredCoinGovernance(coloredCoin);

      expect(await chainTokens.coloredCoinToChain(coloredCoin.coloredCoinId)).not.to.be.equal(coloredCoin.chainId);

      await bridge.connect(validators[3]).registerColoredCoinGovernance(coloredCoin);

      expect(await chainTokens.coloredCoinToChain(coloredCoin.coloredCoinId)).to.be.equal(coloredCoin.chainId);
    });

    it("Should emit newColoredCoinRegistered when coloredCoin is registered", async function () {
      await bridge.connect(validators[0]).registerColoredCoinGovernance(coloredCoin);
      await bridge.connect(validators[1]).registerColoredCoinGovernance(coloredCoin);
      await bridge.connect(validators[2]).registerColoredCoinGovernance(coloredCoin);
      expect(await bridge.connect(validators[3]).registerColoredCoinGovernance(coloredCoin))
        .to.emit(bridge, "newColoredCoinRegistered")
        .withArgs(coloredCoin.chainId, coloredCoin.coloredCoinId);
    });
  });

  let bridge: any;
  let claimsHelper: any;
  let claims: any;
  let chainTokens: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorClaimsBRC: any;
  let validatorClaimsBEC: any;
  let validatorClaimsBEFC: any;
  let validatorClaimsRRC: any;
  let validatorClaimsHWIC: any;
  let signedBatch: any;
  let validatorAddressChainData: any;
  let validators: any;
  let coloredCoin: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    chainTokens = fixture.chainTokens;
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
    coloredCoin = fixture.coloredCoin;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
