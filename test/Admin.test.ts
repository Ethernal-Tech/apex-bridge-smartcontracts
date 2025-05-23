import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Admin Functions", function () {
  beforeEach(async () => {
    // mock isSignatureValid precompile to always return true
    await setCode("0x0000000000000000000000000000000000002050", "0x600160005260206000F3");
    await setCode("0x0000000000000000000000000000000000002060", "0x600160005260206000F3");
  });

  describe("Chain Token Quantity", function () {
    it("Should revert any claim if not called by fundAdmin", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        admin,
        "NotFundAdmin"
      );
    });
    it("Should revert if updateChainTokenQuantity is called on unregistered chain", async function () {
      const { admin, claims } = await loadFixture(deployBridgeFixture);
      await expect(admin.updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        claims,
        "ChainIsNotRegistered"
      );
    });
    it("Should revert if setChainTokenQuantity in Clais is not called by Admin contract", async function () {
      const { claims } = await loadFixture(deployBridgeFixture);
      await expect(claims.updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        claims,
        "NotAdminContract"
      );
    });
    it("Should increase chainTokenQuantity after calling updateChainTokenQuantity", async function () {
      const { admin, bridge, claims, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainTokenQuantity(chain1.id, true, 100);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(200);
    });
    it("Should increase chainTokenQuantity after calling updateChainTokenQuantity with a value higher than the current one", async function () {
      const { admin, bridge, claims, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.updateChainTokenQuantity(chain1.id, true, 200);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(300);
    });
    it("Should emit event after increaseint chain token quantity with updateChainTokenQuantity", async function () {
      const { admin, bridge, claims, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await expect(admin.updateChainTokenQuantity(chain1.id, true, 100)).to.emit(admin, "UpdatedChainTokenQuantity");
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(200);
    });
    it("Should revert if decreae amount is higher than available chainTokenQuantity", async function () {
      const { admin, bridge, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      await expect(admin.updateChainTokenQuantity(1, false, 200)).to.be.revertedWithCustomError(
        admin,
        "NegativeChainTokenAmount"
      );
    });
    it("Should decrease chainTokenQuantity by required amount", async function () {
      const { admin, bridge, claims, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      await admin.updateChainTokenQuantity(chain1.id, false, 50);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(50);
    });
    it("Should emit event after decreasing chain token quantity with updateChainTokenQuantity", async function () {
      const { bridge, admin, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

      await bridge.registerChain(chain1, 100, validatorAddressChainData);

      await expect(admin.updateChainTokenQuantity(chain1.id, false, 50)).to.emit(admin, "UpdatedChainTokenQuantity");
    });
  });
  describe("Setting FundAdmin", function () {
    it("Should revert setFundAdmin is not called by owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).setFundAdmin(validators[0])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert if FundAdmin is ZeroAddress", async function () {
      const { admin } = await loadFixture(deployBridgeFixture);

      await expect(admin.setFundAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(admin, "ZeroAddress");
    });

    it("Should set fundAdmin when called by Owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);

      expect(await admin.fundAdmin()).to.be.equal(validators[0].address);
    });
    it("Should emit ChangedFundAdmin when new fundAdmin is set ", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(await admin.setFundAdmin(validators[0].address))
        .to.emit(admin, "FundAdminChanged")
        .withArgs(validators[0].address);
    });
  });
  describe("Defund chain", function () {
    it("Should revert if defund is not called by fundAdmin", async function () {
      const { admin, validators, owner } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);
      await expect(admin.connect(owner).defund(1, "address", 100)).to.be.revertedWithCustomError(admin, "NotFundAdmin");
    });

    it("Should revert if defund in claims is not called by Admin Contract", async function () {
      const { claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).defund(1, 100, "address")).to.be.revertedWithCustomError(
        claims,
        "NotAdminContract"
      );
    });

    it("Should revert when defund is called and chain is not registered", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await admin.setFundAdmin(validators[0].address);
      await expect(admin.connect(validators[0]).defund(1, "address", 100)).to.be.revertedWithCustomError(
        admin,
        "ChainIsNotRegistered"
      );
    });
    it("Should revert when defund amount is higher then availableTokens amount", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 1, validatorAddressChainData);
      await expect(admin.connect(validators[0]).defund(1, "address", 100)).to.be.revertedWithCustomError(
        claims,
        "DefundRequestTooHigh"
      );
    });
    it("Should remove defund amount from availableTokens amount", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);
      await admin.connect(validators[0]).defund(chain1.id, "address", 1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(99);
    });
    it("Should emit ChainDefunded when defund is exdcuted", async function () {
      const { admin, bridge, owner, validators, chain1, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);

      await admin.connect(validators[0]).defund(chain1.id, "address", 1);

      await expect(await admin.connect(validators[0]).defund(chain1.id, "address", 1))
        .to.emit(admin, "ChainDefunded")
        .withArgs(1, 1);
    });
    it("Should add confirmedTransactioin when defund is exdcuted", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);

      await admin.connect(validators[0]).defund(chain1.id, "address", 1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

      await admin.connect(validators[0]).defund(chain1.id, "address", 1);

      expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });
    it("Should set correct confirmedTransaction when defund is excuted", async function () {
      const { admin, bridge, claims, owner, validators, chain1, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await admin.setFundAdmin(validators[0].address);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);

      await admin.connect(validators[0]).defund(chain1.id, "address", 1);

      expect((await claims.confirmedTransactions(chain1.id, 1)).observedTransactionHash).to.equal(
        await claims.defundHash()
      );
      expect((await claims.confirmedTransactions(chain1.id, 1)).sourceChainId).to.equal(chain1.id);
      expect((await claims.confirmedTransactions(chain1.id, 1)).nonce).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).retryCounter).to.equal(0);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain1.id, 1)).totalAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).blockHeight).to.equal(24);
    });
    it("Should set correct confirmedTransaction when defund fails", async function () {
      const {
        admin,
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        signedBatchDefund,
        validatorAddressChainData,
        validatorClaimsBRC,
        validatorClaimsBEFC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 200, validatorAddressChainData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(1);

      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain2.id, "address", 1);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchDefund);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchDefund);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatchDefund.destinationChainId, signedBatchDefund.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatchDefund.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatchDefund.lastTxNonceId);

      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(2);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claims.lastBatchedTxNonce(chain2.id)).to.equal(2);
      expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).sourceChainId).to.equal(chain2.id);
      expect((await claims.confirmedTransactions(chain2.id, 3)).nonce).to.equal(3);
      expect((await claims.confirmedTransactions(chain2.id, 3)).retryCounter).to.equal(1);
      expect((await claims.confirmedTransactions(chain1.id, 1)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(chain2.id, 3)).totalAmount).to.equal(1);
      expect((await claims.confirmedTransactions(chain2.id, 3)).blockHeight).to.equal(29);
    });
    it("Should reject defund after maximum number of retries", async function () {
      const {
        admin,
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorAddressChainData,
        validatorClaimsBEFC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 200, validatorAddressChainData);

      await admin.setFundAdmin(validators[0].address);

      await admin.connect(validators[0]).defund(chain2.id, "address", 1);

      //to avoid the need for public variable this value should be manually set to the value of MAX_NUMBER_OF_DEFUND_RETRIES
      const retryCounter = 3;

      for (let i = 0; i <= retryCounter; i++) {
        expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 1);
        expect((await claims.confirmedTransactions(chain2.id, i + 1)).retryCounter).to.equal(i);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        signedBatch.firstTxNonceId = i + 1;
        signedBatch.lastTxNonceId = i + 1;
        signedBatch.id = i + 1;

        await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
        await bridge.connect(validators[4]).submitSignedBatch(signedBatch);

        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = i + 1;

        await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
        await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
        await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

        if (i == Number(retryCounter)) {
          await expect(await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC)).to.emit(
            claims,
            "DefundFailedAfterMultipleRetries"
          );
        } else {
          await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

          expect(await claims.lastConfirmedTxNonce(chain2.id)).to.equal(i + 2);

          expect((await claims.confirmedTransactions(chain2.id, i + 2)).retryCounter).to.equal(i + 1);
        }
      }

      // //reseting signedBatch
      signedBatch.firstTxNonceId = 1;
      signedBatch.lastTxNonceId = 1;
      signedBatch.id = 1;

      //reseting validatorClaimsBEFC
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 1;
    });
  });
  describe("Update bridge configurationy", function () {
    it("Calling updateMaxNumberOfTransactions should revert if not called by owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).updateMaxNumberOfTransactions(1)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
    it("Calling updateMaxNumberOfTransactions should update maxNumberOfTransactions", async function () {
      const { admin, claims, owner } = await loadFixture(deployBridgeFixture);

      await admin.connect(owner).updateMaxNumberOfTransactions(4);

      expect(await claims.maxNumberOfTransactions()).to.equal(4);
    });
    it("Calling updateMaxNumberOfTransactions should triger UpdatedMaxNumberOfTransactions event", async function () {
      const { admin, owner } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(owner).updateMaxNumberOfTransactions(4)).to.emit(
        admin,
        "UpdatedMaxNumberOfTransactions"
      );
    });
    it("Calling timeoutBlocksNumber should revert if not called by owner", async function () {
      const { admin, validators } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(validators[0]).updateTimeoutBlocksNumber(1)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
    it("Calling timeoutBlocksNumber should update timeoutBlocksNumber", async function () {
      const { admin, claims, owner } = await loadFixture(deployBridgeFixture);

      await admin.connect(owner).updateTimeoutBlocksNumber(4);

      expect(await claims.timeoutBlocksNumber()).to.equal(4);
    });
    it("Calling timeoutBlocksNumber should triger UpdatgedTimeoutBlocksNumber event", async function () {
      const { admin, owner } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(owner).updateTimeoutBlocksNumber(4)).to.emit(admin, "UpdatedTimeoutBlocksNumber");
    });
  });
});
