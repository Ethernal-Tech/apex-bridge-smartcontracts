import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Batch Creation", function () {
  beforeEach(async () => {
    // mock isSignatureValid precompile to always return true
    await setCode("0x0000000000000000000000000000000000002050", "0x600160005260206000F3");
  });

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

  describe("Batch creation", function () {
    it("SignedBatch submition should return imediatelly if chain is not registered", async function () {
      const { bridge, validators, owner, chain1, chain2, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      const signedBatch_UnregisteredChain = {
        id: 1,
        destinationChainId: "unregisteredChainId1",
        rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
        multisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        feePayerMultisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        firstTxNonceId: 1,
        lastTxNonceId: 1,
      };

      await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch_UnregisteredChain)); // submitSignedBatch should return for unregistered chain
    });

    it("SignedBatch submition should be reverted if not called by validator", async function () {
      const { bridge, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("SignedBatch submition in SignedBatches SC should be reverted if not called by Bridge SC", async function () {
      const { bridge, signedBatches, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(
        signedBatches.connect(owner).submitSignedBatch(signedBatch, owner.address)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("If SignedBatch submition id is not expected submittion should be skipped", async function () {
      const { bridge, signedBatches, claimsHelper, validators, signedBatch } = await loadFixture(deployBridgeFixture);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["uint64", "uint64", "uint64", "uint8", "bytes"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch, validators[0].address);

      const result = await claimsHelper.hasVoted(hash, validators[0].address);

      expect(await signedBatches.hasVoted(hash, validators[0].address)).to.equal(true);

      const oldId = signedBatch.id;
      signedBatch.id = 1000; //invalid id

      const abiCoderFalse = new ethers.AbiCoder();
      const encodedFalse = abiCoder.encode(
        ["uint64", "uint64", "uint64", "uint8", "bytes", "tuple(bytes32, uint64)[]", "tuple(bytes32, uint64)[]"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
          [
            [signedBatch.usedUTXOs.multisigOwnedUTXOs[0].txHash, signedBatch.usedUTXOs.multisigOwnedUTXOs[0].txIndex],
            [signedBatch.usedUTXOs.multisigOwnedUTXOs[1].txHash, signedBatch.usedUTXOs.multisigOwnedUTXOs[1].txIndex],
          ],
          [[signedBatch.usedUTXOs.feePayerOwnedUTXOs[0].txHash, signedBatch.usedUTXOs.feePayerOwnedUTXOs[0].txIndex]],
        ]
      );

      const encoded20False =
        "0x0000000000000000000000000000000000000000000000000000000000000020" + encodedFalse.substring(2);

      const hashFalse = ethers.keccak256(encoded20False);

      await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch, validators[0].address);

      signedBatch.id = oldId;

      expect(await signedBatches.hasVoted(hashFalse, validators[0].address)).to.equal(false);
    });

    it("SignedBatch submition should do nothing if shouldCreateBatch is false", async function () {
      const { bridge, claimsHelper, validators, signedBatch } = await loadFixture(deployBridgeFixture);

      const hash = ethers.solidityPackedKeccak256(
        ["uint64", "uint64", "uint64", "uint8", "bytes"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
        ]
      );

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.equal(false);
    });

    it("getNextBatchId should return 0 if there are no confirmed claims", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);

      // wait for next timeout
      for (let i = 0; i < 10; i++) {
        await ethers.provider.send("evm_mine");
      }

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);
    });

    it("getNextBatchId should return correct id if there are enough confirmed claims", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const validatorClaimsBRC2 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737900000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
    });

    it("getNextBatchId should return correct id if there is timeout", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      // wait for timeout
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
    });

    it("Should not create if current batch block is not -1", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claims.shouldCreateBatch(signedBatch.destinationChainId)).to.equal(false);
    });

    it("SignedBatch should be added to signedBatches if there are enough votes", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);
    });

    it("Should create ConfirmedBatch if there are enough votes", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorsCardanoData, signedBatch, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).rawTransaction
      ).to.equal(signedBatch.rawTransaction);
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures
          .length
      ).to.equal(4);
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .feePayerMultisigSignatures.length
      ).to.equal(4);

      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[0]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[1]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[2]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[3]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        await bridge.connect(validators[0]).getRawTransactionFromLastBatch(signedBatch.destinationChainId)
      ).to.equal(signedBatch.rawTransaction);
    });

    it("Should create and execute batch after transactions are confirmed", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorsCardanoData,
        signedBatch,
        validatorClaimsBEC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await expect(
        bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain)
      ).to.be.revertedWithCustomError(bridge, "CanNotCreateBatchYet");

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      await expect(
        bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain)
      ).to.revertedWithCustomError(bridge, "CanNotCreateBatchYet");
    });

    it("Should return appropriate token amount for signed batch", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
        claims,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const tokenAmount = await claims.getTokenQuantity(signedBatch.destinationChainId);

      let sumAmounts = 0;
      for (let i = 0; i < validatorClaimsBRC.bridgingRequestClaims[0].receivers.length; i++) {
        sumAmounts += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amount;
      }

      expect(tokenAmount).to.equal(sumAmounts);
    });
  });
});
