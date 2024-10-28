import { SignedBatches } from "./../typechain-types/contracts/SignedBatches";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Pruning", function () {
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
  it("Pruning a bunch of claims", async function () {
    const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(
      deployBridgeFixture
    );

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    const claimsBRC = generateValidatorClaimsBRCArray();
    const claimsBEC = generateValidatorClaimsBECArray();
    const claimsBECF = generateValidatorClaimsBEFCArray();
    const claimsRRC = generateValidatorClaimsRRCArray();

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

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(15);

    await claimsHelper.connect(owner).pruneClaims(4, validatorsAddresses, 500);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(6);

    for (let i = 0; i < claimsRRC.length; i += 2) {
      for (let j = 0; j < 4; j++) {
        await bridge.connect(validators[j]).submitClaims(claimsRRC[i]);
      }
    }

    for (let i = 1; i < claimsRRC.length; i += 2) {
      for (let j = 0; j < 4; j++) {
        await bridge.connect(validators[j]).submitClaims(claimsRRC[i]);
      }
    }

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(11);

    await claimsHelper.connect(owner).pruneClaims(4, validatorsAddresses, 30);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(2);
  });
  it("Pruning a bunch of confirmedSignedBatches", async function () {
    const { claims, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

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

    await claimsHelper.connect(owner).pruneConfirmedSignedBatches(1, 10);
    await claimsHelper.connect(owner).pruneConfirmedSignedBatches(2, 10);

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

    expect(await claimsHelper.connect(owner).nextUnprunedConfirmedSignedBatch(1)).to.be.equal(11);

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
    expect(await claimsHelper.connect(owner).nextUnprunedConfirmedSignedBatch(2)).to.be.equal(11);

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
describe("ConfirmedTransactions Pruning", function () {
  it("Pruning a bunch of confirmedTransactions", async function () {
    const { bridge, claims, owner, validators, chain1, chain2, validatorsCardanoData } = await loadFixture(
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

    await claims.connect(owner).pruneConfirmedTransactions(claimsBRC[0].bridgingRequestClaims[0].destinationChainId, 3);

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
describe("Slots Pruning", function () {
  it("Pruning bunch of slots", async function () {
    const { bridge, slots, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
      deployBridgeFixture
    );

    // let encoded = ethers.solidityPacked(
    //   ["uint8", "bytes32", "uint256"],
    //   [1, cardanoBlocks[0].blockHash, cardanoBlocks[0].blockSlot]
    // );

    // const hash0 = ethers.keccak256(encoded);

    // encoded = ethers.solidityPacked(
    //   ["uint8", "bytes32", "uint256"],
    //   [1, cardanoBlocks[1].blockHash, cardanoBlocks[1].blockSlot]
    // );

    // const hash1 = ethers.keccak256(encoded);

    // await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    // expect((await slots.getSlotsHashes()).length).to.equal(0);

    // await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);

    // expect((await slots.getSlotsHashes()).length).to.equal(2);
    // expect((await slots.slotsHashes(0)).hashValue).to.equal(hash0);
    // expect((await slots.slotsHashes(1)).hashValue).to.equal(hash1);
  });
});
describe("SignedBatches Pruning", function () {
  it("Pruning a bunch of SignedBatches", async function () {
    const {
      bridge,
      signedBatches,
      owner,
      chain1,
      chain2,
      validators,
      signedBatch,
      validatorsCardanoData,
      validatorClaimsBRC,
    } = await loadFixture(deployBridgeFixture);

    // const encoded = ethers.solidityPacked(
    //   ["uint64", "uint64", "uint64", "uint8", "bytes"],
    //   [
    //     signedBatch.id,
    //     signedBatch.firstTxNonceId,
    //     signedBatch.lastTxNonceId,
    //     signedBatch.destinationChainId,
    //     signedBatch.rawTransaction,
    //   ]
    // );

    // const hash = ethers.keccak256(encoded);

    // await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
    // await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

    // await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    // await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    // await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    // await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

    // // wait for next timeout
    // for (let i = 0; i < 3; i++) {
    //   await ethers.provider.send("evm_mine");
    // }

    // expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(0);

    // await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

    // expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(1);
  });
});

function generateValidatorClaimsBRCArray() {
  const claimsArray = [];

  for (let i = 0; i < 5; i++) {
    const observedTransactionHash = `0x746573740000000000000000000000000000000000000000000000000000000${0 + i}`;
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

  for (let i = 0; i < 5; i++) {
    const observedTransactionHash = `0x74657375000000000000000000000000000000000000000000000000000000${10 + i}`;
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

  for (let i = 0; i < 5; i++) {
    const observedTransactionHash = `0x74657374000000000000000000000000000000000000000000000000000000${20 + i}`;
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

  for (let i = 0; i < 5; i++) {
    const observedTransactionHash = `0x74657374000000000000000000000000000000000000000000000000000000${30 + i}`;
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

function getConfirmedTransactionsChain1() {
  const confirmedTransactions = [];

  for (let i = 0; i < 20; i++) {
    confirmedTransactions.push({
      totalAmount: 1,
      retryCounter: Math.floor(Math.random() * 1000),
      nonce: i,
      sourceChainId: 1,
      observedTransactionHash: "0x" + crypto.randomUUID().replace(/-/g, ""),
      Receiver: [
        {
          amount: 1,
          destinationAddress: "address",
        },
      ],
    });
  }
  return confirmedTransactions;
}

function getConfirmedTransactionsChain2() {
  const confirmedTransactions = [];

  for (let i = 0; i < 20; i++) {
    confirmedTransactions.push({
      totalAmount: 1,
      retryCounter: Math.floor(Math.random() * 1000),
      nonce: i,
      sourceChainId: 1,
      observedTransactionHash: "0x" + crypto.randomUUID().replace(/-/g, ""),
      Receiver: [
        {
          amount: 1,
          destinationAddress: "address",
        },
      ],
    });
  }
  return confirmedTransactions;
}
