import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Pruning", function () {
  describe("Claims Pruning", function () {
    it("Should revert if pruneClaims is not called by Admin contract", async function () {
      const { claimsHelper, validators } = await loadFixture(deployBridgeFixture);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      await expect(
        claimsHelper.connect(validators[0]).pruneClaims(validatorsAddresses, 5)
      ).to.be.revertedWithCustomError(claimsHelper, "NotAdminContract");
    });
    it("Should revert calling pruneClaims ttl has NOT passed", async function () {
      const { claimsHelper, admin, owner } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(owner).pruneClaims(105)).to.be.revertedWithCustomError(claimsHelper, "TTLTooLow");
    });
    it("Calling pruneClaims should remove hash if ttl has passed", async function () {
      const {
        bridge,
        claimsHelper,
        admin,
        owner,
        validators,
        validatorClaimsBRC,
        chain1,
        chain2,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].retryCounter,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );
      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);
      const hash = ethers.keccak256(encoded40);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(true);
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(true);
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(true);
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.equal(true);
      expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(4);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claimsHelper.connect(adminContract).pruneClaims(validatorsAddresses, MIN_CLAIM_BLOCK_AGE - 75n);

      expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);
      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(false);
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(false);
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(false);
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.equal(false);
      expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(0);
    });
  });
  describe("ConfirmedSignedBatches Pruning", function () {
    it("Should revert if pruneConfirmedSignedBatches is not called by Admin contract", async function () {
      const { claimsHelper, validators } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(validators[0]).pruneConfirmedSignedBatches(1, 5)).to.be.revertedWithCustomError(
        claimsHelper,
        "NotAdminContract"
      );
    });
    it("Should revert if _deleteToBatchId is lower than MIN_NUMBER_OF_SIGNED_BATCHES", async function () {
      const { bridge, claimsHelper, admin, owner, chain1, chain2, validatorsCardanoData, validators, signedBatch } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await expect(
        admin.connect(owner).pruneConfirmedSignedBatches(signedBatch.destinationChainId, 1)
      ).to.be.revertedWithCustomError(claimsHelper, "ConfirmedTransactionsProtectedFromPruning");
    });
    it("Should revert if _deleteToBatchId than protected number of signed batches", async function () {
      const { bridge, claimsHelper, signedBatches, admin, owner, chain1, chain2, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const signedBatchesArray1 = getSignedBatches1();

      const signedBatchesContract = await impersonateAsContractAndMintFunds(await signedBatches.getAddress());

      for (let i = 0; i < 20; i++) {
        await claimsHelper.connect(signedBatchesContract).setConfirmedSignedBatchData(signedBatchesArray1[i]);
      }

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      await expect(
        admin
          .connect(owner)
          .pruneConfirmedSignedBatches(signedBatchesArray1[0].destinationChainId, MIN_CLAIM_BLOCK_AGE + 100n)
      ).to.be.revertedWithCustomError(claimsHelper, "ConfirmedTransactionsProtectedFromPruning");
    });
    it("Should prune confirmedSignedBatches when conditions are met", async function () {
      const { bridge, claimsHelper, admin, owner, chain1, chain2, validatorsCardanoData, signedBatches } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const signedBatchesArray1 = getSignedBatches1();

      const signedBatchesContract = await impersonateAsContractAndMintFunds(await signedBatches.getAddress());

      for (let i = 0; i < 20; i++) {
        await claimsHelper.connect(signedBatchesContract).setConfirmedSignedBatchData(signedBatchesArray1[i]);
      }

      expect(await claimsHelper.nextUnprunedConfirmedSignedBatchId(signedBatchesArray1[0].destinationChainId)).to.equal(
        0
      );

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claimsHelper
        .connect(adminContract)
        .pruneConfirmedSignedBatches(signedBatchesArray1[0].destinationChainId, 10);

      expect(await claimsHelper.nextUnprunedConfirmedSignedBatchId(signedBatchesArray1[0].destinationChainId)).to.equal(
        11
      );

      for (let i = 0; i < 10; i++) {
        expect(
          (await claimsHelper.getConfirmedSignedBatchData(signedBatchesArray1[0].destinationChainId, i)).firstTxNonceId
        ).to.equal(0);
        expect(
          (await claimsHelper.getConfirmedSignedBatchData(signedBatchesArray1[0].destinationChainId, i)).lastTxNonceId
        ).to.equal(0);
      }
      for (let i = 11; i < 20; i++) {
        expect(
          (await claimsHelper.getConfirmedSignedBatchData(signedBatchesArray1[0].destinationChainId, i)).firstTxNonceId
        ).to.equal(i);
        expect(
          (await claimsHelper.getConfirmedSignedBatchData(signedBatchesArray1[0].destinationChainId, i)).lastTxNonceId
        ).to.equal(i);
      }
    });
  });
  describe("Slots Pruning", function () {
    it("Should revert if pruneSlots is not called by Admin Contract", async function () {
      const { slots, validators } = await loadFixture(deployBridgeFixture);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      await expect(slots.connect(validators[0]).pruneSlots(validatorsAddresses, 5)).to.be.revertedWithCustomError(
        slots,
        "NotAdminContract"
      );
    });
    it("Should revert calling pruneSLots if ttl has NOT passed", async function () {
      const { admin, slots, owner } = await loadFixture(deployBridgeFixture);

      await expect(admin.connect(owner).pruneSlots(5)).to.be.revertedWithCustomError(slots, "TTLTooLow");
    });
    it("Calling pruneSlots should remove hash if TTL has passed", async function () {
      const { bridge, slots, admin, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } =
        await loadFixture(deployBridgeFixture);

      let encoded = ethers.solidityPacked(
        ["uint8", "bytes32", "uint256"],
        [1, cardanoBlocks[0].blockHash, cardanoBlocks[0].blockSlot]
      );

      const hash0 = ethers.keccak256(encoded);

      encoded = ethers.solidityPacked(
        ["uint8", "bytes32", "uint256"],
        [1, cardanoBlocks[1].blockHash, cardanoBlocks[1].blockSlot]
      );

      const hash1 = ethers.keccak256(encoded);

      encoded = ethers.solidityPacked(["uint8", "bytes32", "uint256"], [1, cardanoBlocks[0].blockHash, 3]);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      expect((await slots.getSlotsHashes()).length).to.equal(0);

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

      expect((await slots.getSlotsHashes()).length).to.equal(2);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash0, validators[3].address)).to.be.equal(true);
      expect(await slots.numberOfVotes(hash0)).to.be.equal(4);
      expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(true);
      expect(await slots.hasVoted(hash1, validators[3].address)).to.be.equal(true);
      expect(await slots.numberOfVotes(hash1)).to.be.equal(4);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await slots.connect(adminContract).pruneSlots(validatorsAddresses, MIN_CLAIM_BLOCK_AGE - 76n);

      expect((await slots.getSlotsHashes()).length).to.be.equal(0);
      expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash0, validators[3].address)).to.be.equal(false);
      expect(await slots.numberOfVotes(hash0)).to.be.equal(0);
      expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(false);
      expect(await slots.hasVoted(hash1, validators[3].address)).to.be.equal(false);
      expect(await slots.numberOfVotes(hash1)).to.be.equal(0);
    });
  });
  describe("SignedBatches Pruning", function () {
    it("Should revert if pruneSignedBatches is not called by Admin Contract", async function () {
      const { signedBatches, validators } = await loadFixture(deployBridgeFixture);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      await expect(
        signedBatches.connect(validators[0]).pruneSignedBatches(4, validatorsAddresses, 5)
      ).to.be.revertedWithCustomError(signedBatches, "NotAdminContract");
    });
    it("Should revert if min TTL has not yet passed", async function () {
      const { signedBatches, admin, validators, owner } = await loadFixture(deployBridgeFixture);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      await expect(admin.connect(owner).pruneSignedBatches(5)).to.be.revertedWithCustomError(
        signedBatches,
        "TTLTooLow"
      );
    });
    it("Calling pruneSignedBatches should remove hashes when ttl has passed", async function () {
      const {
        bridge,
        signedBatches,
        admin,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      const encoded = ethers.solidityPacked(
        ["uint64", "uint64", "uint64", "uint8", "bytes"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
        ]
      );

      const hash = ethers.keccak256(encoded);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

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

      expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(1);
      expect((await signedBatches.getSignatures(hash)).length).to.be.equal(3);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await signedBatches.connect(adminContract).pruneSignedBatches(4, validatorsAddresses, MIN_CLAIM_BLOCK_AGE - 69n);

      expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(0);
      expect((await signedBatches.getSignatures(hash)).length).to.be.equal(0);
    });
  });
  describe("ConfirmedTransaction Pruning", function () {
    it("Should revert if pruneConfirmedTransactions is not called by Admin Contract", async function () {
      const { claims, validators } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(validators[0]).pruneConfirmedTransactions(1, 5)).to.be.revertedWithCustomError(
        claims,
        "NotAdminContract"
      );
    });
    it("Should revert if _deleteToNonce is lower than lastPrunedConfirmedtransaction", async function () {
      const { bridge, claims, admin, owner, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const claimsBRC = generateValidatorClaimsBRCArray();

      for (let i = 0; i < claimsBRC.length; i++) {
        for (let j = 0; j < 4; j++) {
          await bridge.connect(validators[j]).submitClaims(claimsBRC[i]);
        }
      }

      expect(
        await claims.nextUnprunedConfirmedTransaction(claimsBRC[0].bridgingRequestClaims[0].destinationChainId)
      ).to.equal(0);

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claims
        .connect(adminContract)
        .pruneConfirmedTransactions(claimsBRC[0].bridgingRequestClaims[0].destinationChainId, 3);

      await expect(
        admin.connect(owner).pruneConfirmedTransactions(claimsBRC[0].bridgingRequestClaims[0].destinationChainId, 3)
      ).to.be.revertedWithCustomError(claims, "AlreadyPruned");
    });
    it("Should prune confirmedSignedTransactions when conditions are met", async function () {
      const { bridge, claims, admin, owner, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const claimsBRC = generateValidatorClaimsBRCArray();

      for (let i = 0; i < claimsBRC.length; i++) {
        for (let j = 0; j < 4; j++) {
          await bridge.connect(validators[j]).submitClaims(claimsBRC[i]);
        }
      }

      const chainId = claimsBRC[0].bridgingRequestClaims[0].destinationChainId;

      expect(await claims.nextUnprunedConfirmedTransaction(chainId)).to.equal(0);

      expect(await claims.lastConfirmedTxNonce(chainId)).to.equal(20);

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claims.connect(adminContract).pruneConfirmedTransactions(chainId, 10);

      expect(await claims.nextUnprunedConfirmedTransaction(chainId)).to.equal(11);

      for (let i = 1; i <= 10; i++) {
        expect((await claims.confirmedTransactions(chainId, i)).blockHeight).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).totalAmount).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).retryCounter).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).nonce).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).sourceChainId).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).observedTransactionHash).to.be.equal(
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
      }

      for (let i = 11; i <= 20; i++) {
        expect((await claims.confirmedTransactions(chainId, i)).totalAmount).to.be.equal(1);
        expect((await claims.confirmedTransactions(chainId, i)).retryCounter).to.be.equal(0);
        expect((await claims.confirmedTransactions(chainId, i)).sourceChainId).to.be.equal(1);
      }
    });
  });
});

function generateValidatorClaimsBRCArray() {
  const claimsArray = [];

  for (let i = 0; i < 20; i++) {
    const observedTransactionHash = `0x74657374000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    const validatorClaimsBRC = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: observedTransactionHash,
          receivers: [
            {
              amount: 1,
              destinationAddress: "0x123...", // Using a fixed address for simplicity
            },
          ],
          totalAmount: 1,
          retryCounter: 0,
          sourceChainId: 1,
          destinationChainId: 2,
        },
      ],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      hotWalletIncrementClaims: [],
    };
    claimsArray.push(validatorClaimsBRC);
  }

  return claimsArray;
}
function getSignedBatches1() {
  const signedBatches = [];

  for (let i = 1; i < 21; i++) {
    let rawTransactionTemp = `0x74657377000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;

    let signatureTemp = `0x74657378000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;

    let feeSignatureTemp = `0x74657379000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;

    signedBatches.push({
      id: i,
      destinationChainId: 2,
      rawTransaction: rawTransactionTemp,
      signature: signatureTemp,
      feeSignature: feeSignatureTemp,
      firstTxNonceId: i,
      lastTxNonceId: i,
    });
  }
  return signedBatches;
}

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
