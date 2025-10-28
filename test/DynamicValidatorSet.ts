import { SpecialSignedBatches } from "./../typechain-types/contracts/SpecialSignedBatches";
import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

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
      const { bridge, owner, validatorsc, validators, validatorSets } = await loadFixture(deployBridgeFixture);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());
      await validatorsc.connect(bridgeContract).setNewValidatorSetPending(true);

      await expect(
        bridge.connect(owner).submitNewValidatorSet(validatorSets, validators)
      ).to.be.revertedWithCustomError(bridge, "NewValidatorSetAlreadyPending");
    });

    it("Should revert if there is no new data set for all registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_notEnoughChains, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_notEnoughChains, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is too many data sets compared to registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_TooManyChains, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_TooManyChains, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is not enough validators in the new validator set for all registered chains", async function () {
      const {
        bridge,
        owner,
        validators,
        chain1,
        chain2,
        validatorSets_NotEnoughValidators,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_NotEnoughValidators, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if there is too many validators in the new validator set for all registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_TooManyValidators, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_TooManyValidators, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if validator address is zero address", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_ZeroAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(
        bridge.connect(owner).submitNewValidatorSet(validatorSets_ZeroAddress, validators)
      ).to.be.revertedWithCustomError(bridge, "ZeroAddress");
    });

    it("Should revert if validator address is duplicated within a set", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_DoubleAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_DoubleAddress, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("DuplicatedValidator");
    });

    it("Should store addresses of validators to be removed from the new set", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(0);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.be.equal(validators.length);

      const validatorsToBeRemoved = await validatorsc.getValidatorsToBeRemoved();
      const validatorsToBeRemovedLenght = validatorsToBeRemoved.length;

      for (let i = 0; i < validatorsToBeRemovedLenght; i++) {
        expect(validatorsToBeRemoved[i]).to.be.equal(validators[i]);
      }
    });

    it("Should store proposed validator set", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect((await validatorsc.getNewValidatorSet()).length).to.be.equal(validatorSets.length);

      const newValidatorSet = await validatorsc.getNewValidatorSet();

      for (let i = 0; i < newValidatorSet.length; i++) {
        expect(newValidatorSet[i].chainId).to.be.equal(validatorSets[i].chainId);
        for (let j = 0; j < newValidatorSet[i].validators.length; j++) {
          expect(newValidatorSet[i].validators[j].addr.toLocaleLowerCase()).to.be.equal(
            validatorSets[i].validators[j].addr
          );
          expect(newValidatorSet[i].validators[j].keySignature).to.be.equal(
            validatorSets[i].validators[j].keySignature
          );
          expect(newValidatorSet[i].validators[j].keyFeeSignature).to.be.equal(
            validatorSets[i].validators[j].keyFeeSignature
          );
          for (let k = 0; k < newValidatorSet[i].validators[j].data.length; k++) {
            expect(newValidatorSet[i].validators[j].data.key[k]).to.be.equal(
              validatorSets[i].validators[j].data.key[k]
            );
          }
        }
      }
    });

    it("Should set newPendingValidatorSet to true when new ValidatorSet is submitted", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      expect(await validatorsc.newValidatorSetPending()).to.be.false;

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect(await validatorsc.newValidatorSetPending()).to.be.true;
    });

    it("Should emit newValidatorSetSubmitted when new ValidatorSet is submitted", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets, validators)).to.emit(
        bridge,
        "newValidatorSetSubmitted"
      );
    });
  });

  describe("Submit new Special Signed Batch", function () {
    it("Should revert if there is no new validator set pending", async function () {
      const { bridge, validators, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitSpecialSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NoNewValidatorSetPending"
      );
    });

    it("Should revert signedBatch submition if signature is not valid", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3"); // should return false for precompile
      await expect(
        bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch)
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("SignedBatch submition in SpecialSignedBatches SC should be reverted if not called by Bridge SC", async function () {
      const { bridge, specialSignedBatches, owner, specialSignedBatch } = await loadFixture(deployBridgeFixture);

      await expect(
        specialSignedBatches.connect(owner).submitSpecialSignedBatch(specialSignedBatch, owner.address)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("If SignedBatch submition id is not expected submittion should be skipped", async function () {
      const { bridge, signedBatches, specialSignedBatches, validators, specialSignedBatch } = await loadFixture(
        deployBridgeFixture
      );

      const encoded = ethers.solidityPacked(
        ["uint64", "uint64", "uint64", "uint8", "bytes", "bool"],
        [
          specialSignedBatch.id,
          specialSignedBatch.firstTxNonceId,
          specialSignedBatch.lastTxNonceId,
          specialSignedBatch.destinationChainId,
          specialSignedBatch.rawTransaction,
          specialSignedBatch.isConsolidation,
        ]
      );

      const hash = ethers.keccak256(encoded);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      await specialSignedBatches
        .connect(bridgeContract)
        .submitSpecialSignedBatch(specialSignedBatch, validators[0].address);

      expect(await signedBatches.hasVoted(hash, validators[0].address)).to.equal(true);

      const oldId = specialSignedBatch.id;
      specialSignedBatch.id = 1000; //invalid id

      const encodedFalse = ethers.solidityPacked(
        ["uint64", "uint64", "uint64", "uint8", "bytes", "bool"],
        [
          specialSignedBatch.id,
          specialSignedBatch.firstTxNonceId,
          specialSignedBatch.lastTxNonceId,
          specialSignedBatch.destinationChainId,
          specialSignedBatch.rawTransaction,
          specialSignedBatch.isConsolidation,
        ]
      );

      const hashFalse = ethers.keccak256(encodedFalse);

      await signedBatches.connect(bridgeContract).submitSignedBatch(specialSignedBatch, validators[0].address);

      specialSignedBatch.id = oldId;

      expect(await signedBatches.hasVoted(hashFalse, validators[0].address)).to.equal(false);
    });

    it("SignedBatch should NOT be added to signedBatches if there are NOT enough votes", async function () {
      const {
        bridge,
        specialSignedBatches,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorSets,
        specialSignedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch); // resubmit

      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(specialSignedBatch.destinationChainId, specialSignedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      const batchId = await specialSignedBatches.getSpecialConfirmedBatchId(specialSignedBatch.destinationChainId);

      const lastConfirmedSignedBatchData = await claimsHelper.specialConfirmedSignedBatches(
        specialSignedBatch.destinationChainId,
        batchId
      );

      expect(lastConfirmedSignedBatchData.firstTxNonceId).to.equal(0);
      expect(lastConfirmedSignedBatchData.lastTxNonceId).to.equal(0);
      expect(lastConfirmedSignedBatchData.isConsolidation).to.equal(false);
      expect(lastConfirmedSignedBatchData.status).to.equal(0);

      const confBatch = await specialSignedBatches.getSpecialConfirmedBatch(specialSignedBatch.destinationChainId);

      expect(confBatch.signatures.length).to.equal(0);
      expect(confBatch.feeSignatures.length).to.equal(0);
      expect(confBatch.bitmap).to.equal(0);
      expect(confBatch.rawTransaction).to.equal("0x");
      expect(confBatch.isConsolidation).to.equal(false);
      expect(confBatch.id).to.equal(0);
    });

    it("SignedBatch should be added to signedBatches if there are enough votes", async function () {
      const {
        bridge,
        specialSignedBatches,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorSets,
        specialSignedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(specialSignedBatch.destinationChainId, specialSignedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      const batchId = await specialSignedBatches.getSpecialConfirmedBatchId(specialSignedBatch.destinationChainId);

      const lastConfirmedSignedBatchData = await claimsHelper.specialConfirmedSignedBatches(
        specialSignedBatch.destinationChainId,
        batchId
      );

      expect(lastConfirmedSignedBatchData.firstTxNonceId).to.equal(2n ** 64n - 1n);
      expect(lastConfirmedSignedBatchData.lastTxNonceId).to.equal(2n ** 64n - 1n);
      expect(lastConfirmedSignedBatchData.isConsolidation).to.equal(false);
      expect(lastConfirmedSignedBatchData.status).to.equal(1);

      const confBatch = await specialSignedBatches.getSpecialConfirmedBatch(specialSignedBatch.destinationChainId);

      expect(confBatch.signatures.length).to.equal(4);
      expect(confBatch.feeSignatures.length).to.equal(4);
      expect(confBatch.bitmap).to.equal(15);
      expect(confBatch.rawTransaction).to.equal(specialSignedBatch.rawTransaction);
      expect(confBatch.isConsolidation).to.equal(specialSignedBatch.isConsolidation);
      expect(confBatch.id).to.equal(specialSignedBatch.id);
    });
  });

  describe("Submit new Special Batch Executed Claims", function () {
    it("Should revert if there is no new validator set pending", async function () {
      const { bridge, validators, validatorClaimsBEC } = await loadFixture(deployBridgeFixture);
      await expect(bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(
        bridge,
        "NoNewValidatorSetPending"
      );
    });

    it("Should revert if there are BRCs, RRCs or HWICs in ValidatorClaims", async function () {
      const {
        bridge,
        owner,
        validators,
        chain1,
        chain2,
        validatorSets,
        validatorClaimsBRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await expect(bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "WrongSpecialClaims"
      );
    });

    it("Should revert if there are more than 32 claims in the array", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorSets,
        validatorClaimsBEC_bunch33,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await expect(
        bridge.connect(validators[1]).submitClaims(validatorClaimsBEC_bunch33)
      ).to.be.revertedWithCustomError(bridge, "TooManyClaims");
    });

    it("Should skip if there are wrong first and lastTxNonceId", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorSets,
        signedBatch,
        validatorClaimsBEC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(signedBatch);

      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if Batch Executed Claims is already confirmed", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitSpecialClaims(validatorClaimsBEC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if validator submits the same claim twice", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for SBEFC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEC,
        validatorClaimsBEFC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hashBEC = ethers.keccak256(encoded40);

      const encodedPrefixBEFC = abiCoder.encode(["string"], ["SBEFC"]);
      const encodedBEFC = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40BEFC =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEFC.substring(2) +
        encodedPrefixBEFC.substring(66);
      const hashBEFC = ethers.keccak256(encoded40BEFC);

      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      // Second claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    });

    it("Should skip if there is already a quorum for another BEC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEC,
        validatorClaimsBEC_another,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC_another);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hashBEC = ethers.keccak256(encoded40);

      // Calculate BEC_another hash
      const encodedPrefixBEC_another = abiCoder.encode(["string"], ["SBEC"]);
      const encodedBEC_another = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC_another.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC_another.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC_another.batchExecutedClaims[0].chainId,
        ]
      );
      const encoded40BEC_another =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEC_another.substring(2) +
        encodedPrefixBEC_another.substring(66);
      const hashBEC_another = ethers.keccak256(encoded40BEC_another);

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEC_another);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC_another);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    });

    it("Should set batch executed status if there is quorum on SBEC", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      // before quorum
      expect(
        (
          await claimsHelper.getSpecialConfirmedSignedBatchData(
            specialSignedBatch.destinationChainId,
            specialSignedBatch.id
          )
        ).status
      ).to.equal(1);

      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      // after quorum
      expect(
        (
          await claimsHelper.getSpecialConfirmedSignedBatchData(
            specialSignedBatch.destinationChainId,
            specialSignedBatch.id
          )
        ).status
      ).to.equal(2);
    });

    it("Should emit ValidatorSetUpdateReady if there is quorum on final batch in SBEC for all registered chains", async function () {
      const {
        bridge,
        specialClaims,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      //first chain
      // sets consolidation to true for this test
      specialSignedBatch.isConsolidation = true;

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      // reset
      specialSignedBatch.isConsolidation = false; // reset

      //first chain
      // sets consolidation to true for this test
      specialSignedBatch.isConsolidation = true;
      specialSignedBatch.destinationChainId = 1;

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      // reset
      specialSignedBatch.destinationChainId = 2;

      //second chain
      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      // reset
      specialSignedBatch.isConsolidation = false;

      // first chain
      validatorClaimsBEC.batchExecutedClaims[0].chainId = 1;
      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      // reset
      validatorClaimsBEC.batchExecutedClaims[0].chainId = 2;

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      await expect(bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC)).to.emit(
        specialClaims,
        "ValidatorSetUpdateReady"
      );
    });

    it("Should NOT set bitmap to +1 if there is quorum on non-final batch in SBEC", async function () {
      const {
        bridge,
        specialClaims,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      // specialSignedBatch has isConsolidation set to false

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      let bitmap = await specialClaims.bitmap();

      let count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);

      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      bitmap = await specialClaims.bitmap();

      count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);
    });

    it("Should set bitmap to +1 if there is quorum on final batch in SBEC", async function () {
      const {
        bridge,
        specialClaims,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      // sets consolidation to true for this test
      specialSignedBatch.isConsolidation = true;

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      // reset
      specialSignedBatch.isConsolidation = false; // reset

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      let bitmap = await specialClaims.bitmap();

      let count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(0);

      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      bitmap = await specialClaims.bitmap();

      count = 0;
      while (bitmap !== 0n) {
        bitmap &= bitmap - 1n; // Clear the lowest set bit
        count++;
      }

      expect(count).to.equal(1);
    });
  });

  describe("Submit new Special Batch Execution Failed Claims", function () {
    it("Should skip if there are wrong first and lastTxNonceId", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorSets,
        signedBatch,
        validatorClaimsBEFC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(signedBatch);

      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEFC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if Batch Executed Claims is already confirmed", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEFC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEFC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitSpecialClaims(validatorClaimsBEFC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if validator submits the same claim twice", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEFC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEFC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for SBEC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBEC,
        validatorClaimsBEFC,
        specialSignedBatch,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEC);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hashBEC = ethers.keccak256(encoded40);

      const encodedPrefixBEFC = abiCoder.encode(["string"], ["SBEFC"]);
      const encodedBEFC = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40BEFC =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEFC.substring(2) +
        encodedPrefixBEFC.substring(66);
      const hashBEFC = ethers.keccak256(encoded40BEFC);

      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC);

      // Second claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    });

    it("Should skip if there is already a quorum for another BEFC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEFC,
        validatorClaimsBEFC_another,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC_another);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["SBEFC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hashBEC = ethers.keccak256(encoded40);

      // Calculate BEC_another hash
      const encodedPrefixBEC_another = abiCoder.encode(["string"], ["SBEFC"]);
      const encodedBEC_another = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].chainId,
        ]
      );
      const encoded40BEC_another =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEC_another.substring(2) +
        encodedPrefixBEC_another.substring(66);
      const hashBEC_another = ethers.keccak256(encoded40BEC_another);

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEC_another);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC_another);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    });

    it("Should set batch failed status if there is quorum on SBEFC", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEFC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);

      // before quorum
      expect(
        (
          await claimsHelper.getSpecialConfirmedSignedBatchData(
            specialSignedBatch.destinationChainId,
            specialSignedBatch.id
          )
        ).status
      ).to.equal(1);

      await bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC);

      // after quorum
      expect(
        (
          await claimsHelper.getSpecialConfirmedSignedBatchData(
            specialSignedBatch.destinationChainId,
            specialSignedBatch.id
          )
        ).status
      ).to.equal(3);
    });

    it("Should emit SpecialSignedBatchExecutionFailed if there is quorum on SBEFC", async function () {
      const {
        bridge,
        specialClaims,
        owner,
        validators,
        chain1,
        chain2,
        specialSignedBatch,
        validatorClaimsBEFC,
        validatorSets,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      await bridge.connect(validators[0]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[1]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[2]).submitSpecialSignedBatch(specialSignedBatch);
      await bridge.connect(validators[3]).submitSpecialSignedBatch(specialSignedBatch);

      await bridge.connect(validators[0]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitSpecialClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitSpecialClaims(validatorClaimsBEFC);

      await expect(bridge.connect(validators[3]).submitSpecialClaims(validatorClaimsBEFC)).to.emit(
        specialClaims,
        "SpecialSignedBatchExecutionFailed"
      );
    });
  });
  describe("New validator set confirmed on Blade", function () {
    it("Validator set should be updated", async function () {
      // const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
      //   await loadFixture(deployBridgeFixture);
      // await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      // await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
      // await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);
      // expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(5);
      // await bridge.validatorSetUpdated();
      // expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(0);
    });

    it("Data about validaters to be removed should be deleted", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(5);
      await bridge.validatorSetUpdated();
      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(0);
    });

    it("Bridge should be unlocked", async function () {
      const {
        bridge,
        validatorsc,
        owner,
        validators,
        chain1,
        chain2,
        validatorSets,
        validatorAddressChainData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect(await validatorsc.newValidatorSetPending()).to.equal(true);
      await bridge.validatorSetUpdated();
      expect(await validatorsc.newValidatorSetPending()).to.equal(false);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    });
  });
});
