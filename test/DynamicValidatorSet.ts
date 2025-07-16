import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BatchType, deployBridgeFixture } from "./fixtures";

describe("Dynamic Validator Set", function () {
  async function impersonateAsContractAndMintFunds(contractAddress: string) {
    const hre = require("hardhat");
    const address = await contractAddress.toLowerCase();
    // impersonate as an contract on specified address
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });

    const signer = await ethers.getSigner(address);
    // minting 100000000000000000000 tokens to signer
    await ethers.provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]);

    return signer;
  }
  describe("Submit new validator set", function () {
    it("Should revert if there is already a new validator set pending", async function () {
      const { bridge, owner, validatorsc, newValidatorSetDelta } = await loadFixture(deployBridgeFixture);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());
      await validatorsc.connect(bridgeContract).setNewValidatorSetPending(true);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta)).to.be.revertedWithCustomError(
        bridge,
        "NewValidatorSetPending"
      );
    });

    it("Should revert if there is no new data set for all registered chains", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta_notEnoughChains, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_notEnoughChains))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is too many data sets compared to registered chains", async function () {
      const { bridge, owner, newValidatorSetDelta_TooManyChains } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_TooManyChains))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is not enough validators in the new validator set for all registered chains", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta_NotEnoughValidators, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_NotEnoughValidators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if there is too many validators in the new validator set for all registered chains", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta_TooManyValidators, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_TooManyValidators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if validator address is zero address", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta_ZeroAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(
        bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_ZeroAddress)
      ).to.be.revertedWithCustomError(bridge, "ZeroAddress");
    });

    it("Should revert if validator address is duplicated within a set", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta_DoubleAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta_DoubleAddress))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("DuplicatedValidator");
    });

    it("Should store proposed newValidatorSetDelta", async function () {
      const { bridge, validatorsc, owner, chain1, chain2, newValidatorSetDelta, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      expect((await validatorsc.getNewValidatorSetDelta()).addedValidators.length).to.be.equal(
        newValidatorSetDelta.addedValidators.length
      );

      const storednewValidatorSetDelta = await validatorsc.getNewValidatorSetDelta();
      const addedValidators = storednewValidatorSetDelta.addedValidators;

      for (let i = 0; i < addedValidators.length; i++) {
        expect(addedValidators[i].chainId).to.be.equal(newValidatorSetDelta.addedValidators[i].chainId);
        for (let j = 0; j < addedValidators[i].validators.length; j++) {
          expect(addedValidators[i].validators[j].addr.toLocaleLowerCase()).to.be.equal(
            newValidatorSetDelta.addedValidators[i].validators[j].addr
          );
          expect(addedValidators[i].validators[j].keySignature).to.be.equal(
            newValidatorSetDelta.addedValidators[i].validators[j].keySignature
          );
          expect(addedValidators[i].validators[j].keyFeeSignature).to.be.equal(
            newValidatorSetDelta.addedValidators[i].validators[j].keyFeeSignature
          );
          for (let k = 0; k < addedValidators[i].validators[j].data.length; k++) {
            expect(addedValidators[i].validators[j].data.key[k]).to.be.equal(
              newValidatorSetDelta.addedValidators[i].validators[j].data.key[k]
            );
          }
        }
      }

      const storedNewValidatorSetDelta = await validatorsc.getNewValidatorSetDelta();
      const removedValidators = storedNewValidatorSetDelta.removedValidators;

      for (let i = 0; i < removedValidators.length; i++) {
        expect(removedValidators[i]).to.be.equal(newValidatorSetDelta.removedValidators[i]);
      }
    });

    it("Should set newPendingValidatorSet to true when new ValidatorSet is submitted", async function () {
      const { bridge, validatorsc, owner, chain1, chain2, newValidatorSetDelta, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      expect(await validatorsc.newValidatorSetPending()).to.be.false;

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      expect(await validatorsc.newValidatorSetPending()).to.be.true;
    });

    it("Should emit newValidatorSetSubmitted when new ValidatorSet is submitted", async function () {
      const { bridge, owner, chain1, chain2, newValidatorSetDelta, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta)).to.emit(
        bridge,
        "newValidatorSetSubmitted"
      );
    });
  });

  describe("Submit new Validator Set Signed Batch", function () {
    it("Should revert if there is no new validator set pending", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch_ValidatorSet,
        validatorAddressChainData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      await expect(
        bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet)
      ).to.be.revertedWithCustomError(bridge, "NoNewValidatorSetPending");
    });

    it("Should revert signedBatch submition if signature is not valid", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch_ValidatorSet,
        newValidatorSetDelta,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3"); // should return false for precompile
      await expect(
        bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet)
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("SignedBatch submition in signedBatch_ValidatorSets SC should be reverted if not called by Bridge SC", async function () {
      const { bridge, signedBatches, owner, signedBatch_ValidatorSet } = await loadFixture(deployBridgeFixture);

      await expect(
        signedBatches.connect(owner).submitSignedBatch(signedBatch_ValidatorSet, owner.address)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("If SignedBatch submission id is not expected submission should be skipped", async function () {
      const { bridge, signedBatches, validators, signedBatch_ValidatorSet } = await loadFixture(deployBridgeFixture);

      const encoded = ethers.solidityPacked(
        ["uint64", "uint64", "uint64", "uint8", "bytes", "uint8"],
        [
          signedBatch_ValidatorSet.id,
          signedBatch_ValidatorSet.firstTxNonceId,
          signedBatch_ValidatorSet.lastTxNonceId,
          signedBatch_ValidatorSet.destinationChainId,
          signedBatch_ValidatorSet.rawTransaction,
          signedBatch_ValidatorSet.batchType,
        ]
      );

      const hash = ethers.keccak256(encoded);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch_ValidatorSet, validators[0].address);

      expect(await signedBatches.hasVoted(hash, validators[0].address)).to.equal(true);

      const oldId = signedBatch_ValidatorSet.id;
      signedBatch_ValidatorSet.id = 1000; //invalid id

      const encodedFalse = ethers.solidityPacked(
        ["uint64", "uint64", "uint64", "uint8", "bytes", "uint8"],
        [
          signedBatch_ValidatorSet.id,
          signedBatch_ValidatorSet.firstTxNonceId,
          signedBatch_ValidatorSet.lastTxNonceId,
          signedBatch_ValidatorSet.destinationChainId,
          signedBatch_ValidatorSet.rawTransaction,
          signedBatch_ValidatorSet.batchType,
        ]
      );

      const hashFalse = ethers.keccak256(encodedFalse);

      await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch_ValidatorSet, validators[0].address);

      signedBatch_ValidatorSet.id = oldId;

      expect(await signedBatches.hasVoted(hashFalse, validators[0].address)).to.equal(false);
    });

    it("SignedBatch should NOT be added to signedBatches if there are NOT enough votes", async function () {
      const {
        bridge,
        signedBatches,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        newValidatorSetDelta,
        signedBatch_ValidatorSet,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_ValidatorSet);

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet); // resubmit

      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch_ValidatorSet.destinationChainId, signedBatch_ValidatorSet.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      const batchId = await signedBatches.getConfirmedBatchId(signedBatch_ValidatorSet.destinationChainId);

      const lastConfirmedSignedBatchData = await claimsHelper.confirmedSignedBatches(
        signedBatch_ValidatorSet.destinationChainId,
        batchId
      );

      expect(lastConfirmedSignedBatchData.firstTxNonceId).to.equal(0);
      expect(lastConfirmedSignedBatchData.lastTxNonceId).to.equal(0);
      expect(lastConfirmedSignedBatchData.status).to.equal(0);
      expect(lastConfirmedSignedBatchData.isConsolidation).to.equal(false);
      expect(lastConfirmedSignedBatchData.batchType).to.equal(BatchType.NORMAL);

      const confBatch = await signedBatches.getConfirmedBatch(signedBatch_ValidatorSet.destinationChainId);

      expect(confBatch.signatures.length).to.equal(0);
      expect(confBatch.feeSignatures.length).to.equal(0);
      expect(confBatch.bitmap).to.equal(0);
      expect(confBatch.rawTransaction).to.equal("0x");
      expect(confBatch.isConsolidation).to.equal(false);
      expect(confBatch.batchType).to.equal(BatchType.NORMAL);
      expect(confBatch.id).to.equal(0);
    });

    it("SignedBatch should be added to signedBatches if there are enough votes on ValidatorSet", async function () {
      const {
        bridge,
        signedBatches,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        newValidatorSetDelta,
        signedBatch_ValidatorSet,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_ValidatorSet);

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch_ValidatorSet.destinationChainId, signedBatch_ValidatorSet.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch_ValidatorSet);

      const batchId = await signedBatches.getConfirmedBatchId(signedBatch_ValidatorSet.destinationChainId);

      const lastConfirmedSignedBatchData = await claimsHelper.confirmedSignedBatches(
        signedBatch_ValidatorSet.destinationChainId,
        batchId
      );

      expect(lastConfirmedSignedBatchData.firstTxNonceId).to.equal(2n ** 64n - 1n);
      expect(lastConfirmedSignedBatchData.lastTxNonceId).to.equal(2n ** 64n - 1n);
      expect(lastConfirmedSignedBatchData.isConsolidation).to.equal(false);
      expect(lastConfirmedSignedBatchData.status).to.equal(1);
      expect(lastConfirmedSignedBatchData.batchType).to.equal(BatchType.VALIDATORSET);

      const confBatch = await signedBatches.getConfirmedBatch(signedBatch_ValidatorSet.destinationChainId);

      expect(confBatch.signatures.length).to.equal(4);
      expect(confBatch.feeSignatures.length).to.equal(4);
      expect(confBatch.bitmap).to.equal(15);
      expect(confBatch.rawTransaction).to.equal(signedBatch_ValidatorSet.rawTransaction);
      expect(confBatch.isConsolidation).to.equal(false);
      expect(confBatch.batchType).to.equal(signedBatch_ValidatorSet.batchType);
      expect(confBatch.id).to.equal(signedBatch_ValidatorSet.id);
    });
  });

  describe("Submit new Validator Set Batch Executed Claims", function () {
    it("Should revert if there are BRCs, RRCs or HWICs in ValidatorClaims", async function () {
      const {
        bridge,
        owner,
        validators,
        chain1,
        chain2,
        newValidatorSetDelta,
        validatorClaimsBRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NewValidatorSetPending"
      );
    });

    it("Should not revert if there is new validator set pending", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBEC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC)).not.to.be.reverted;
    });

    it("Should NOT set bitmap to +1 if there is quorum on non-final batch in SBEC", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain1,
        chain2,
        signedBatch_ValidatorSet,
        validatorClaimsBEC,
        newValidatorSetDelta,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch_ValidatorSet);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      let bitmap = await claims.newValidatorSetBitmap();

      let count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      bitmap = await claims.newValidatorSetBitmap();

      count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);
    });

    it("Should set bitmap to +1 if there is quorum on final batch in BEC", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain1,
        chain2,
        signedBatch_ValidatorSetFinal,
        validatorClaimsBEC,
        newValidatorSetDelta,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSetFinal);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSetFinal);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_ValidatorSetFinal);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch_ValidatorSetFinal);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      let bitmap = await claims.newValidatorSetBitmap();

      let count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      bitmap = await claims.newValidatorSetBitmap();

      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(1);
    });
  });

  describe("Submit new Validator Set Batch Execution Failed Claims", function () {
    it("Should emit signedBatch_ValidatorSetExecutionFailed if there is quorum on BEFC", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain1,
        chain2,
        signedBatch_ValidatorSet,
        validatorClaimsBEFC,
        newValidatorSetDelta,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_ValidatorSet);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch_ValidatorSet);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      await expect(bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC)).to.emit(
        claims,
        "SignedBatchValidatorSetExecutionFailed"
      );
    });
  });
  describe("New validator set confirmed on Blade", function () {
    it("Validator set should be updated", async function () {
      const {
        bridge,
        validatorsc,
        owner,
        validators,
        chain1,
        chain2,
        newValidatorSetDelta,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      // current validators
      for (let i = 0; i < validators.length; i++) {
        expect(await validatorsc.isValidator(validators[i].address)).to.equal(true);
      }

      // added validator set
      for (let i = 0; i < newValidatorSetDelta.addedValidators[0].validators.length; i++) {
        expect(await validatorsc.isValidator(newValidatorSetDelta.addedValidators[0].validators[i].addr)).to.equal(
          false
        );
      }

      // old validatorsCount
      expect(await validatorsc.validatorsCount()).to.equal(validators.length);

      // old number of validators addresses
      expect((await validatorsc.getValidatorsAddresses()).length).to.equal(validators.length);

      await bridge.validatorSetUpdated();

      // old validators should be removed
      for (let i = 0; i < newValidatorSetDelta.removedValidators.length; i++) {
        expect(await validatorsc.isValidator(newValidatorSetDelta.removedValidators[i])).to.equal(false);
      }

      // new validators are added to the set
      for (let i = 0; i < newValidatorSetDelta.addedValidators[0].validators.length; i++) {
        expect(await validatorsc.isValidator(newValidatorSetDelta.addedValidators[0].validators[i].addr)).to.equal(
          true
        );
      }

      // new validatorsCount
      expect(await validatorsc.validatorsCount()).to.equal(
        validators.length +
          newValidatorSetDelta.addedValidators[0].validators.length -
          newValidatorSetDelta.removedValidators.length
      );

      // old number of validators addresses
      expect((await validatorsc.getValidatorsAddresses()).length).to.equal(
        validators.length +
          newValidatorSetDelta.addedValidators[0].validators.length -
          newValidatorSetDelta.removedValidators.length
      );

      let newValidatorAddresses = [];

      for (let i = 0; i < validators.length; i++) {
        newValidatorAddresses.push(validators[i].address);
      }

      const addressesToRemove = newValidatorSetDelta.removedValidators;

      for (let i = 0; i < addressesToRemove.length; i++) {
        const index = newValidatorAddresses.indexOf(addressesToRemove[i]);
        if (index > -1) {
          newValidatorAddresses.splice(index, 1);
        }
      }

      for (let i = 0; i < newValidatorSetDelta.addedValidators[0].validators.length; i++) {
        newValidatorAddresses.push(newValidatorSetDelta.addedValidators[0].validators[i].addr);
      }

      // comparing validator addresses
      expect(await validatorsc.getValidatorsAddresses()).to.deep.equal(newValidatorAddresses);

      // comparing chain data
      const chains = await bridge.getAllRegisteredChains();

      const fourthKey = validatorAddressChainData[3].data.key;
      const fifthKey = validatorAddressChainData[4].data.key;

      // NOT to include chainData
      for (let i = 0; i < chains.length; i++) {
        const chainData = await validatorsc.getValidatorsChainData(chains[i].id);
        for (let j = 0; j < newValidatorSetDelta.addedValidators[0].validators.length; j++) {
          const targetFourth = fourthKey.map(BigInt);
          const targetFifth = fifthKey.map(BigInt);

          const foundFourth = chainData.some(
            (entry) =>
              Array.isArray(entry[0]) &&
              entry[0].length === targetFourth.length &&
              entry[0].every((val, i) => val === targetFourth[i])
          );

          expect(foundFourth).to.be.false;

          const foundFifth = chainData.some(
            (entry) =>
              Array.isArray(entry[0]) &&
              entry[0].length === targetFifth.length &&
              entry[0].every((val, i) => val === targetFifth[i])
          );

          expect(foundFifth).to.be.false;
        }
      }

      // to include chainData
      for (let i = 0; i < chains.length; i++) {
        const chainData = await validatorsc.getValidatorsChainData(chains[i].id);
        for (let j = 0; j < newValidatorSetDelta.addedValidators[0].validators.length; j++) {
          const target = newValidatorSetDelta.addedValidators[0].validators[j].data.key.map(BigInt);

          const found = chainData.some(
            (entry) =>
              Array.isArray(entry[0]) &&
              entry[0].length === target.length &&
              entry[0].every((val, i) => val === target[i])
          );

          expect(found).to.be.true;
        }
      }
    });

    it("Data about validaters to be removed should be deleted", async function () {
      const { bridge, validatorsc, owner, chain1, chain2, newValidatorSetDelta, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      expect((await validatorsc.getNewValidatorSetDelta()).addedValidators.length).to.equal(2);
      expect((await validatorsc.getNewValidatorSetDelta()).removedValidators.length).to.equal(2);
      await bridge.validatorSetUpdated();
      await expect(bridge.getNewValidatorSetDelta()).to.be.revertedWithCustomError(bridge, "NoNewValidatorSetPending");
    });

    it("Bridge should be unlocked", async function () {
      const { bridge, validatorsc, owner, chain1, chain2, newValidatorSetDelta, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      expect(await validatorsc.newValidatorSetPending()).to.equal(true);
      await bridge.validatorSetUpdated();
      expect(await validatorsc.newValidatorSetPending()).to.equal(false);
    });
  });
});
