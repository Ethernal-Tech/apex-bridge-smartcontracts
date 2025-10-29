import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";
import hre from "hardhat";

describe("Chain Tokens", function () {
    describe("BRC Tokens Quantity Validations", function () {
        it("Should revert if validateBRC is not called by Claims SC", async function () {
            await expect(chainTokens.connect(owner).validateBRC(validatorClaimsBRC.bridgingRequestClaims[0], 1)).to.be.revertedWithCustomError(
                chainTokens,
                "NotClaims"
            );
        });

        it("Should emit NotEnoughFunds for colored coin with insufficient balance", async function () {
            // Setup: register colored coin on destination chain
            const destColoredCoin = structuredClone(coloredCoin);
            destColoredCoin.chainId = chain2.id;
            // Register colored coin on dest chain
            await bridge.connect(owner).registerColoredCoin(destColoredCoin);

            const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
            temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = destColoredCoin.coloredCoinId;
            temp_validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 200;
            temp_validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination = 0;

            await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC))
                .to.emit(chainTokens, "NotEnoughFunds")
                .withArgs("BRC - Colored Coin", 0, 0);
        });

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
        it("Should revert if validateRRC is not called by Claims SC", async function () {
            await expect(chainTokens.connect(owner).validateRRC(validatorClaimsRRC.refundRequestClaims[0], 1)).to.be.revertedWithCustomError(
                chainTokens,
                "NotClaims"
            );
        });

        it("Should emit NotEnoughFunds for colored coin with insufficient balance", async function () {
            // Setup: register colored coin on destination chain
            const sourceColoredCoin = structuredClone(coloredCoin);
            // Register colored coin on dest chain
            await bridge.connect(owner).registerColoredCoin(sourceColoredCoin);

            const temp_validatorClaimsRRC = structuredClone(validatorClaimsRRC);
            temp_validatorClaimsRRC.refundRequestClaims[0].coloredCoinId = sourceColoredCoin.coloredCoinId;
            temp_validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
            temp_validatorClaimsRRC.refundRequestClaims[0].originAmount = 200;
            temp_validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount = 0;
            temp_validatorClaimsRRC.refundRequestClaims[0].originChainId = sourceColoredCoin.chainId;

            await expect(bridge.connect(validators[0]).submitClaims(temp_validatorClaimsRRC))
                .to.emit(chainTokens, "NotEnoughFunds")
                .withArgs("RRC - Colored Coin", 0, 0);
        });

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
        it("Should revert if defund is not called by Claims SC", async function () {
            await expect(chainTokens.connect(owner).validateDefund(chain1.id, 1, 1, 0)).to.be.revertedWithCustomError(
                chainTokens,
                "NotClaims"
            );
        });

        it("Should revert with DefundRequestTooHigh error for colored coin with insufficient balance", async function () {
            await admin.setFundAdmin(validators[0].address);
            await bridge.connect(owner).registerColoredCoin(coloredCoin);

            const amount = 101;
            const temp_validatorClaimsBRC = structuredClone(validatorClaimsBRC);
            temp_validatorClaimsBRC.bridgingRequestClaims[0].coloredCoinId = 1;

            await bridge.connect(validators[0]).submitClaims(temp_validatorClaimsBRC);
            await bridge.connect(validators[1]).submitClaims(temp_validatorClaimsBRC);
            await bridge.connect(validators[2]).submitClaims(temp_validatorClaimsBRC);
            await bridge.connect(validators[4]).submitClaims(temp_validatorClaimsBRC);

            expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
            expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(200);
            expect(await chainTokens.chainColoredCoinQuantity(coloredCoin.chainId, coloredCoin.coloredCoinId)).to.equal(100);
            await expect(admin.connect(validators[0]).defund(chain1.id, amount, 1, 1, "address"))
                .to.be.revertedWithCustomError(chainTokens, "DefundRequestTooHigh")
                .withArgs("Defund - Colored Coin", chain1.id, 100, amount);
        });

        it("Should revert with DefundRequestTooHigh error for currency with insufficient token quantity", async function () {
            await admin.setFundAdmin(validators[0].address);
            const amount = 101;

            expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
            expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
            await expect(admin.connect(validators[0]).defund(chain1.id, amount, 0, 0, "address"))
                .to.be.revertedWithCustomError(chainTokens, "DefundRequestTooHigh")
                .withArgs("Defund - Currency", chain1.id, 100, amount);
        });

        it("Should revert with DefundRequestTooHigh error for wrapped token with insufficient balance", async function () {
            await admin.setFundAdmin(validators[0].address);
            const amount = 101;

            expect(await chainTokens.chainTokenQuantity(chain1.id)).to.equal(100);
            expect(await chainTokens.chainWrappedTokenQuantity(chain1.id)).to.equal(100);
            await expect(admin.connect(validators[0]).defund(chain1.id, 0, amount, 0, "address"))
                .to.be.revertedWithCustomError(chainTokens, "DefundRequestTooHigh")
                .withArgs("Defund - Native Token", chain1.id, 100, amount);
        });
    });

    let bridge: any;
    let claimsHelper: any;
    let chainTokens: any;
    let claims: any;
    let admin: any;
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
        coloredCoin = fixture.coloredCoin;

        // Register chains
        await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
        await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
    });
});