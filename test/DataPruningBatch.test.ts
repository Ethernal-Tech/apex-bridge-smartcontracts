import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Pruning", function () {
  it("Pruning a bunch of claims", async function () {
    const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

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

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });
});
describe("Slots Pruning", function () {
  it("Pruning bunch of slots", async function () {
    const { bridge, slots, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
      deployBridgeFixture
    );

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

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    expect((await slots.getSlotsHashes()).length).to.equal(0);

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);
    expect((await slots.slotsHashes(0)).hashValue).to.equal(hash0);
    expect((await slots.slotsHashes(1)).hashValue).to.equal(hash1);
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

    expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(0);

    await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

    expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(1);
  });
});

const validatorClaimsBRC1 = {
  bridgingRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000001",
      receivers: [
        {
          amount: 100,
          destinationAddress: "0x123...",
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

const validatorClaimsBRC2 = {
  bridgingRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000002",
      receivers: [
        {
          amount: 100,
          destinationAddress: "0x123...",
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

const validatorClaimsBRC3 = {
  bridgingRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000003",
      receivers: [
        {
          amount: 100,
          destinationAddress: "0x123...",
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

const validatorClaimsBRC4 = {
  bridgingRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000004",
      receivers: [
        {
          amount: 100,
          destinationAddress: "0x123...",
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

const validatorClaimsBRC5 = {
  bridgingRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000005",
      receivers: [
        {
          amount: 100,
          destinationAddress: "0x123...",
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

const validatorClaimsBEC1 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [
    {
      observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000011",
      chainId: 2,
      batchNonceId: 2,
    },
  ],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEC2 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [
    {
      observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000012",
      chainId: 2,
      batchNonceId: 3,
    },
  ],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEC3 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [
    {
      observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000013",
      chainId: 2,
      batchNonceId: 4,
    },
  ],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEC4 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [
    {
      observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000014",
      chainId: 2,
      batchNonceId: 5,
    },
  ],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEC5 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [
    {
      observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000015",
      chainId: 2,
      batchNonceId: 6,
    },
  ],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEFC1 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000021",
      chainId: 2,
      batchNonceId: 2,
    },
  ],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEFC2 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000022",
      chainId: 2,
      batchNonceId: 3,
    },
  ],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEFC3 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000023",
      chainId: 2,
      batchNonceId: 4,
    },
  ],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEFC4 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000024",
      chainId: 2,
      batchNonceId: 5,
    },
  ],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsBEFC5 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000025",
      chainId: 2,
      batchNonceId: 6,
    },
  ],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsRRC1 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000031",
      previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000031",
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      retryCounter: 1,
      chainId: 2,
      receiver: "receiver1",
    },
  ],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsRRC2 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000032",
      previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000032",
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      retryCounter: 1,
      chainId: 2,
      receiver: "receiver1",
    },
  ],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsRRC3 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000033",
      previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000033",
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      retryCounter: 1,
      chainId: 2,
      receiver: "receiver1",
    },
  ],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsRRC4 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000034",
      previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000034",
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      retryCounter: 1,
      chainId: 2,
      receiver: "receiver1",
    },
  ],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};

const validatorClaimsRRC5 = {
  bridgingRequestClaims: [],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [
    {
      observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000035",
      previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000035",
      signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      retryCounter: 1,
      chainId: 2,
      receiver: "receiver1",
    },
  ],
  refundExecutedClaims: [],
  hotWalletIncrementClaims: [],
};
