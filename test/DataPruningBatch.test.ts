import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Batch Pruning", function () {
  describe("Batch Claims Pruning", function () {
    it("Pruning a bunch of claims", async function () {
      const { bridge, claimsHelper, admin, owner, chain1, chain2, validators, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      const claimsBRC = generateValidatorClaimsBRCArray();
      const claimsBEC = generateValidatorClaimsBECArray();
      const claimsBECF = generateValidatorClaimsBEFCArray();

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      for (let i = 0; i < claimsBRC.length; i += 2) {
        for (let j = 0; j < 4; j++) {
          await bridge.connect(validators[j]).submitClaims(claimsBRC[i]);
          await bridge.connect(validators[j]).submitClaims(claimsBEC[i]);
          await bridge.connect(validators[j]).submitClaims(claimsBECF[i]);
        }
      }

      for (let i = 1; i < claimsBRC.length; i += 2) {
        for (let j = 0; j < 3; j++) {
          await bridge.connect(validators[j]).submitClaims(claimsBRC[i]);
          await bridge.connect(validators[j]).submitClaims(claimsBEC[i]);
          await bridge.connect(validators[j]).submitClaims(claimsBECF[i]);
        }
      }

      expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(60);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      const currentBlockNumber = await ethers.provider.getBlockNumber();

      const deleteTo = Number(currentBlockNumber) - Number(MIN_CLAIM_BLOCK_AGE) - Number(90);

      await admin.connect(owner).pruneClaims(deleteTo);

      expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(30);
    });
    it("Pruning a bunch of confirmedSignedBatches", async function () {
      const { claims, claimsHelper, admin, owner } = await loadFixture(deployBridgeFixture);

      const signedBatchesChain1 = getSignedBatchArrayChain1();
      const signedBatchesChain2 = getSignedBatchArrayChain2();

      const claimsContract = await impersonateAsContractAndMintFunds(await claims.getAddress());

      for (let i = 0; i < 20; i++) {
        await claimsHelper.connect(claimsContract).setConfirmedSignedBatchData(signedBatchesChain1[i]);
        await claimsHelper.connect(claimsContract).setConfirmedSignedBatchData(signedBatchesChain2[i]);
      }

      for (let i = 0; i < 20; i++) {
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain1[i].destinationChainId,
              signedBatchesChain1[i].id
            )
          ).firstTxNonceId
        ).to.be.equal(signedBatchesChain1[i].firstTxNonceId);
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain2[i].destinationChainId,
              signedBatchesChain2[i].id
            )
          ).lastTxNonceId
        ).to.be.equal(signedBatchesChain2[i].lastTxNonceId);
      }

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claimsHelper.connect(adminContract).pruneConfirmedSignedBatches(1, 10);
      await claimsHelper.connect(adminContract).pruneConfirmedSignedBatches(2, 10);

      for (let i = 1; i < 10; i++) {
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain1[i].destinationChainId,
              signedBatchesChain1[i].id
            )
          ).firstTxNonceId
        ).to.be.equal(0);
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain1[i].destinationChainId,
              signedBatchesChain1[i].id
            )
          ).lastTxNonceId
        ).to.be.equal(0);
      }

      expect(await claimsHelper.connect(owner).nextUnprunedConfirmedSignedBatchId(1)).to.be.equal(11);

      for (let i = 1; i < 10; i++) {
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain2[i].destinationChainId,
              signedBatchesChain2[i].id
            )
          ).firstTxNonceId
        ).to.be.equal(0);
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain2[i].destinationChainId,
              signedBatchesChain2[i].id
            )
          ).lastTxNonceId
        ).to.be.equal(0);
      }
      expect(await claimsHelper.connect(owner).nextUnprunedConfirmedSignedBatchId(2)).to.be.equal(11);

      for (let i = 11; i < 20; i++) {
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain1[i].destinationChainId,
              signedBatchesChain1[i].id
            )
          ).firstTxNonceId
        ).to.be.equal(signedBatchesChain1[i].firstTxNonceId);
        expect(
          (
            await claimsHelper.confirmedSignedBatches(
              signedBatchesChain2[i].destinationChainId,
              signedBatchesChain2[i].id
            )
          ).lastTxNonceId
        ).to.be.equal(signedBatchesChain2[i].lastTxNonceId);
      }
    });
  });
  describe("Batch ConfirmedTransactions Pruning", function () {
    it("Pruning a bunch of confirmedTransactions", async function () {
      const { bridge, claims, admin, owner, validators, chain1, chain2, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const claimsBRC = generateValidatorClaimsBRCArray();

      for (let i = 0; i < claimsBRC.length; i++) {
        for (let j = 0; j < 4; j++) {
          await bridge.connect(validators[j]).submitClaims(claimsBRC[i]);
        }
      }

      for (let i = 0; i < claimsBRC.length; i++) {
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .totalAmount
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].totalAmount);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .retryCounter
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].retryCounter);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .sourceChainId
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].sourceChainId);
      }

      expect(
        await claims.nextUnprunedConfirmedTransaction(claimsBRC[0].bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(0);

      const adminContract = await impersonateAsContractAndMintFunds(await admin.getAddress());

      await claims
        .connect(adminContract)
        .pruneConfirmedTransactions(claimsBRC[0].bridgingRequestClaims[0].destinationChainId, 3);

      expect(
        await claims.nextUnprunedConfirmedTransaction(claimsBRC[0].bridgingRequestClaims[0].destinationChainId)
      ).to.be.equal(4);

      for (let i = 0; i < 3; i++) {
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .totalAmount
        ).to.be.equal(0);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .retryCounter
        ).to.be.equal(0);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .sourceChainId
        ).to.be.equal(0);
      }

      for (let i = 3; i < 5; i++) {
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .totalAmount
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].totalAmount);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .retryCounter
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].retryCounter);
        expect(
          (await claims.confirmedTransactions(claimsBRC[i].bridgingRequestClaims[0].destinationChainId, i + 1))
            .sourceChainId
        ).to.be.equal(claimsBRC[i].bridgingRequestClaims[0].sourceChainId);
      }
    });
  });
  describe("Batch Slots Pruning", function () {
    it("Pruning bunch of slots", async function () {
      const { bridge, slots, admin, owner, validators } = await loadFixture(deployBridgeFixture);

      const validatorsAddresses = [];
      for (let i = 0; i < validators.length; i++) {
        validatorsAddresses.push(validators[i].address);
      }

      const cardanoBlocks1 = getCardanoBlockArray1();
      const cardanoBlocks2 = getCardanoBlockArray2();

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      expect(await slots.connect(owner).getSlotsHashes()).to.be.empty;

      for (let i = 0; i < 4; i++) {
        await slots.connect(bridgeContract).updateBlocks(1, cardanoBlocks1, validators[i]);
      }

      expect((await slots.connect(owner).getSlotsHashes()).length).to.be.equal(20);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      let currentBlockNumber = await ethers.provider.getBlockNumber();

      await admin.connect(owner).pruneSlots(currentBlockNumber - Number(MIN_CLAIM_BLOCK_AGE));

      expect((await slots.connect(owner).getSlotsHashes()).length).to.be.equal(0);

      for (let i = 0; i < 3; i++) {
        await slots.connect(bridgeContract).updateBlocks(2, cardanoBlocks2, validators[i]);
      }

      expect((await slots.connect(owner).getSlotsHashes()).length).to.be.equal(20);

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }
      currentBlockNumber = await ethers.provider.getBlockNumber();

      await admin.connect(owner).pruneSlots(currentBlockNumber - Number(MIN_CLAIM_BLOCK_AGE));

      expect((await slots.connect(owner).getSlotsHashes()).length).to.be.equal(0);
    });
  });
  describe("Batch SignedBatches Pruning", function () {
    it("Pruning a bunch of SignedBatches", async function () {
      const { bridge, signedBatches, admin, owner, validators } = await loadFixture(deployBridgeFixture);

      const signedBatchesArray1 = getSignedBatches1();
      const signedBatchesArray2 = getSignedBatches2();

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      expect((await signedBatches.connect(owner).getSignedBatchesHashes()).length).to.be.equal(0);

      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 4; j++) {
          await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatchesArray1[i], validators[j]);
        }
      }

      expect((await signedBatches.connect(owner).getSignedBatchesHashes()).length).to.be.equal(20);

      const MIN_CLAIM_BLOCK_AGE = await admin.MIN_CLAIM_BLOCK_AGE();

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      await admin.connect(owner).pruneSignedBatches(MIN_CLAIM_BLOCK_AGE);

      expect((await signedBatches.connect(owner).getSignedBatchesHashes()).length).to.be.equal(0);

      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 3; j++) {
          await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatchesArray2[i], validators[j]);
        }
      }

      expect((await signedBatches.connect(owner).getSignedBatchesHashes()).length).to.be.equal(20);

      for (let i = 0; i < MIN_CLAIM_BLOCK_AGE; i++) {
        await ethers.provider.send("evm_mine");
      }

      const currentBlockNumber = await ethers.provider.getBlockNumber();

      await admin.connect(owner).pruneSignedBatches(Number(currentBlockNumber) - Number(MIN_CLAIM_BLOCK_AGE) - 31);

      expect((await signedBatches.connect(owner).getSignedBatchesHashes()).length).to.be.equal(10);
    });
  });
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

function generateValidatorClaimsBRCArray() {
  const claimsArray = [];

  for (let i = 0; i < 20; i++) {
    // const observedTransactionHash = `0x746573740000000000000000000000000000000000000000000000000000000${0 + i}`;
    const observedTransactionHash = `0x74657374000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    const validatorClaimsBRC5 = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: observedTransactionHash,
          receivers: [
            {
              amount: 100,
              destinationAddress: "0x123...", // Using a fixed address for simplicity
            },
          ],
          totalAmount: 100,
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
    claimsArray.push(validatorClaimsBRC5);
  }

  return claimsArray;
}

function generateValidatorClaimsBECArray() {
  const claimsArray = [];

  for (let i = 0; i < 20; i++) {
    const observedTransactionHash = `0x74657375000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    const validatorClaimsBEC5 = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [
        {
          observedTransactionHash: observedTransactionHash,
          chainId: 2,
          batchNonceId: 6 + i, // Incremented batchNonceId for each JSON
        },
      ],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      hotWalletIncrementClaims: [],
    };
    claimsArray.push(validatorClaimsBEC5);
  }

  return claimsArray;
}

function generateValidatorClaimsBEFCArray() {
  const claimsArray = [];

  for (let i = 0; i < 20; i++) {
    const observedTransactionHash = `0x74657376000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    const validatorClaimsBEFC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [
        {
          observedTransactionHash: observedTransactionHash,
          chainId: 2,
          batchNonceId: i, // Unique batchNonceId for each JSON
        },
      ],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      hotWalletIncrementClaims: [],
    };
    claimsArray.push(validatorClaimsBEFC);
  }

  return claimsArray;
}

function generateValidatorClaimsRRCArray() {
  const claimsArray = [];

  for (let i = 0; i < 20; i++) {
    const observedTransactionHash = `0x74657377000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    const validatorClaimsRRC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [
        {
          observedTransactionHash: observedTransactionHash,
          previousRefundTxHash: observedTransactionHash, // Using the same hash for simplicity
          signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
          rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
          retryCounter: 1,
          chainId: 2,
          receiver: `receiver${i + 1}`, // Adding unique receiver for each JSON
        },
      ],
      refundExecutedClaims: [],
      hotWalletIncrementClaims: [],
    };
    claimsArray.push(validatorClaimsRRC);
  }

  return claimsArray;
}

function hashBRC(validatorClaimsBRC) {
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

  return hash;
}

function hashBEC(validatorClaimsBEC) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BEC"]);
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

  return hash;
}

function hashBEFC(validatorClaimsBEFC) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BEFC"]);
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

  return hash;
}

function hashRRC(validatorClaimsRRC) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
  const encoded = abiCoder.encode(
    ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
    [
      validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
      validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
      validatorClaimsRRC.refundRequestClaims[0].signature,
      validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
      validatorClaimsRRC.refundRequestClaims[0].retryCounter,
      validatorClaimsRRC.refundRequestClaims[0].chainId,
      validatorClaimsRRC.refundRequestClaims[0].receiver,
    ]
  );

  const encoded40 =
    "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    encodedPrefix.substring(66) +
    encoded.substring(2);

  const hash = ethers.keccak256(encoded40);

  return hash;
}

function getSignedBatchArrayChain1() {
  const signedBatches = [];

  for (let i = 0; i < 20; i++) {
    signedBatches.push({
      id: i,
      firstTxNonceId: Math.floor(Math.random() * 1000),
      lastTxNonceId: Math.floor(Math.random() * 1000),
      destinationChainId: 1,
      signature: "0x" + crypto.randomUUID().replace(/-/g, ""),
      feeSignature: "0x" + crypto.randomUUID().replace(/-/g, ""),
      rawTransaction: "0x" + crypto.randomUUID().replace(/-/g, ""),
    });
  }
  return signedBatches;
}

function getSignedBatchArrayChain2() {
  const signedBatches = [];

  for (let i = 0; i < 20; i++) {
    signedBatches.push({
      id: i,
      firstTxNonceId: Math.floor(Math.random() * 1000),
      lastTxNonceId: Math.floor(Math.random() * 1000),
      destinationChainId: 2,
      signature: "0x" + crypto.randomUUID().replace(/-/g, ""),
      feeSignature: "0x" + crypto.randomUUID().replace(/-/g, ""),
      rawTransaction: "0x" + crypto.randomUUID().replace(/-/g, ""),
    });
  }
  return signedBatches;
}

function getCardanoBlockArray1() {
  const cardanoBlocks = [];

  for (let i = 1; i < 21; i++) {
    let blockHashTemp = `0x74657377000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;
    cardanoBlocks.push({
      blockSlot: i,
      blockHash: blockHashTemp,
    });
  }
  return cardanoBlocks;
}

function getCardanoBlockArray2() {
  const cardanoBlocks = [];

  for (let i = 21; i < 41; i++) {
    let blockHashTemp = `0x74657377000000000000000000000000000000000000000000000000000000${i
      .toString()
      .padStart(2, "0")}`;

    cardanoBlocks.push({
      blockSlot: i,
      blockHash: blockHashTemp,
    });
  }
  return cardanoBlocks;
}

const signedBatch = {
  id: 1,
  destinationChainId: 2,
  rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
  signature: "0x746573740000000000000000000000000000000000000000000000000000000A",
  feeSignature: "0x746573740000000000000000000000000000000000000000000000000000000F",
  firstTxNonceId: 1,
  lastTxNonceId: 1,
};

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

function getSignedBatches2() {
  const signedBatches = [];

  for (let i = 21; i < 41; i++) {
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
      id: 21,
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
