import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Pruning", function () {
  it("Hash should be added to claimsHashes in ClaimsHelper when new claim is submitted", async function () {
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

  it("Only NEW Hashes should be added to claimsHashes in ClaimsHelper when new claim is submitted", async function () {
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

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });
  it("Should revert if pruneClaims is not called by owner", async function () {
    const { claimsHelper, validators } = await loadFixture(deployBridgeFixture);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await expect(
      claimsHelper.connect(validators[0]).pruneClaims(4, validatorsAddresses, 5)
    ).to.be.revertedWithCustomError(claimsHelper, "OwnableUnauthorizedAccount");
  });
  it("Calling pruneClaims should NOT remove hash if quorum is NOT reached and ttl has NOT passed", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
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

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await claimsHelper.connect(owner).pruneClaims(4, validatorsAddresses, 5);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect((await claimsHelper.claimsHashes(0)).hashValue).to.be.equal(hash);
  });
  it("Calling pruneClaims should remove hash if quorum is NOT reached and ttl has passed", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
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

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    for (let i = 0; i < 2; i++) {
      await ethers.provider.send("evm_mine");
    }

    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(3);

    await claimsHelper.connect(owner).pruneClaims(4, validatorsAddresses, 5);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(0);
    expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.equal(false);
    expect(await claimsHelper.numberOfVotes(hash)).to.be.equal(0);
  });
  it("Calling pruneClaims should remove hash if quorum is reached", async function () {
    const { bridge, claimsHelper, owner, validators, validatorClaimsBRC, chain1, chain2, validatorsCardanoData } =
      await loadFixture(deployBridgeFixture);

    await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
    await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

    const abiCoder = new ethers.AbiCoder();
    let encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    let encoded = abiCoder.encode(
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
    let encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash0 = ethers.keccak256(encoded40);

    const validatorClaimsBRC1 = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          receivers: [
            {
              amount: 10,
              destinationAddress: "0x123...",
            },
          ],
          outputUTXO: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
            txIndex: 1,
          },
          totalAmount: 10,
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

    encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
    encoded = abiCoder.encode(
      ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint8", "uint8"],
      [
        validatorClaimsBRC1.bridgingRequestClaims[0].observedTransactionHash,
        [
          [
            validatorClaimsBRC1.bridgingRequestClaims[0].receivers[0].amount,
            validatorClaimsBRC1.bridgingRequestClaims[0].receivers[0].destinationAddress,
          ],
        ],
        validatorClaimsBRC1.bridgingRequestClaims[0].totalAmount,
        validatorClaimsBRC1.bridgingRequestClaims[0].retryCounter,
        validatorClaimsBRC1.bridgingRequestClaims[0].sourceChainId,
        validatorClaimsBRC1.bridgingRequestClaims[0].destinationChainId,
      ]
    );
    encoded40 =
      "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
      encodedPrefix.substring(66) +
      encoded.substring(2);
    const hash1 = ethers.keccak256(encoded40);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);

    await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC1);
    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(2);
    await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC1);
    await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC1);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    // expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(2);
    expect(await claimsHelper.hasVoted(hash0, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash0, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash0, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash0, validators[3].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash0)).to.be.equal(4);
    expect(await claimsHelper.hasVoted(hash1, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash1, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash1, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash1)).to.be.equal(3);

    await claimsHelper.connect(owner).pruneClaims(4, validatorsAddresses, 50);

    expect((await claimsHelper.getClaimsHashes()).length).to.be.equal(1);
    expect(await claimsHelper.hasVoted(hash0, validators[0].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash0, validators[1].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash0, validators[2].address)).to.be.equal(false);
    expect(await claimsHelper.hasVoted(hash0, validators[3].address)).to.be.equal(false);
    expect(await claimsHelper.numberOfVotes(hash0)).to.be.equal(0);
    expect(await claimsHelper.hasVoted(hash1, validators[0].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash1, validators[1].address)).to.be.equal(true);
    expect(await claimsHelper.hasVoted(hash1, validators[2].address)).to.be.equal(true);
    expect(await claimsHelper.numberOfVotes(hash1)).to.be.equal(3);
  });
});
describe("ConfirmedSignedBatches Pruning", function () {
  it("Should revert if pruneConfirmedSignedBatches is not called by owner", async function () {
    const { claimsHelper, validators } = await loadFixture(deployBridgeFixture);

    await expect(claimsHelper.connect(validators[0]).pruneConfirmedSignedBatches(1, 5)).to.be.revertedWithCustomError(
      claimsHelper,
      "OwnableUnauthorizedAccount"
    );
  });
  it("Should revert if _lastConfirmedBatchId is lower then lastPrunedConfirmedSignedBatch", async function () {
    const { claimsHelper, owner } = await loadFixture(deployBridgeFixture);

    await expect(claimsHelper.connect(owner).pruneConfirmedSignedBatches(1, 0)).to.be.revertedWithCustomError(
      claimsHelper,
      "AlreadyPruned"
    );
  });
  it("Should prune confirmedSignedBatches when conditions are met", async function () {
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

    const confBatchNothing = await claimsHelper
      .connect(validators[0])
      .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
    expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

    // consensus
    await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

    expect(await claimsHelper.lastPrunedConfirmedSignedBatch()).to.equal(0);

    expect((await claimsHelper.confirmedSignedBatches(2, 1)).firstTxNonceId).to.equal(1);
    expect((await claimsHelper.confirmedSignedBatches(2, 1)).lastTxNonceId).to.equal(1);

    await claimsHelper.connect(owner).pruneConfirmedSignedBatches(2, 1);

    expect((await claimsHelper.confirmedSignedBatches(2, 1)).firstTxNonceId).to.equal(0);
    expect((await claimsHelper.confirmedSignedBatches(2, 1)).lastTxNonceId).to.equal(0);

    expect(await claimsHelper.lastPrunedConfirmedSignedBatch()).to.equal(0);
  });
});
describe("Slots Pruning", function () {
  it("Hash should be added to claimsHashes in Slots when new slot is submitted", async function () {
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

  it("Only NEW Hashes should be added to claimsHashes in Slots when new slot is submitted", async function () {
    const { bridge, slots, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
      deployBridgeFixture
    );

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    expect((await slots.getSlotsHashes()).length).to.equal(0);

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);
  });
  it("Should revert if pruneSlots is not called by owner", async function () {
    const { slots, validators } = await loadFixture(deployBridgeFixture);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await expect(slots.connect(validators[0]).pruneSlots(4, validatorsAddresses, 5)).to.be.revertedWithCustomError(
      slots,
      "OwnableUnauthorizedAccount"
    );
  });
  it("Calling pruneSlots should NOT remove hash if quorum is NOT reached and ttl has NOT passed", async function () {
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
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await slots.connect(owner).pruneSlots(4, validatorsAddresses, 5);

    expect((await slots.getSlotsHashes()).length).to.equal(2);
  });
  it("Calling pruneSlots should remove hash if quorum is NOT reached and ttl has passed", async function () {
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
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    for (let i = 0; i < 2; i++) {
      await ethers.provider.send("evm_mine");
    }

    expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash0)).to.be.equal(3);
    expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash1)).to.be.equal(3);

    await slots.connect(owner).pruneSlots(4, validatorsAddresses, 5);

    expect((await slots.getSlotsHashes()).length).to.be.equal(0);
    expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(false);
    expect(await slots.numberOfVotes(hash0)).to.be.equal(0);
    expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(false);
    expect(await slots.numberOfVotes(hash1)).to.be.equal(0);
  });
  it("Calling pruneSlots should remove hash if quorum is reached", async function () {
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

    encoded = ethers.solidityPacked(["uint8", "bytes32", "uint256"], [1, cardanoBlocks[0].blockHash, 3]);

    const hash2 = ethers.keccak256(encoded);

    encoded = ethers.solidityPacked(["uint8", "bytes32", "uint256"], [1, cardanoBlocks[1].blockHash, 4]);

    const hash3 = ethers.keccak256(encoded);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    expect((await slots.getSlotsHashes()).length).to.equal(0);

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

    cardanoBlocks[0].blockSlot = 3;
    cardanoBlocks[1].blockSlot = 4;

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(4);

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
    expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash2)).to.be.equal(3);
    expect(await slots.hasVoted(hash3, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash3, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash3, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash3)).to.be.equal(3);

    await slots.connect(owner).pruneSlots(4, validatorsAddresses, 50);

    expect((await slots.getSlotsHashes()).length).to.be.equal(2);
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
    expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash2)).to.be.equal(3);
    expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash3)).to.be.equal(3);
  });
});
describe("SignedBatches Pruning", function () {
  it("Hash should be added to claimsHashes in SignedBatches when new signBatch is submitted", async function () {
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

  it("Only NEW Hashes should be added to claimsHashes in Slots when new slot is submitted", async function () {
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

    await bridge.connect(validators[1]).submitSignedBatch(signedBatch);

    expect((await signedBatches.getSignedBatchesHashes()).length).to.be.equal(1);
  });
  it("Should revert if pruneSlots is not called by owner", async function () {
    const { slots, validators } = await loadFixture(deployBridgeFixture);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await expect(slots.connect(validators[0]).pruneSlots(4, validatorsAddresses, 5)).to.be.revertedWithCustomError(
      slots,
      "OwnableUnauthorizedAccount"
    );
  });
  it("Calling pruneSlots should NOT remove hash if quorum is NOT reached and ttl has NOT passed", async function () {
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
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    await slots.connect(owner).pruneSlots(4, validatorsAddresses, 5);

    expect((await slots.getSlotsHashes()).length).to.equal(2);
  });
  it("Calling pruneSlots should remove hash if quorum is NOT reached and ttl has passed", async function () {
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
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    const validatorsAddresses = [];
    for (let i = 0; i < validators.length; i++) {
      validatorsAddresses.push(validators[i].address);
    }

    expect((await slots.getSlotsHashes()).length).to.equal(2);

    for (let i = 0; i < 2; i++) {
      await ethers.provider.send("evm_mine");
    }

    expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash0)).to.be.equal(3);
    expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(true);
    expect(await slots.numberOfVotes(hash1)).to.be.equal(3);

    await slots.connect(owner).pruneSlots(4, validatorsAddresses, 5);

    expect((await slots.getSlotsHashes()).length).to.be.equal(0);
    expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(false);
    expect(await slots.numberOfVotes(hash0)).to.be.equal(0);
    expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(false);
    expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(false);
    expect(await slots.numberOfVotes(hash1)).to.be.equal(0);
  });
  it("Calling pruneSlots should remove hash if quorum is reached", async function () {
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

    encoded = ethers.solidityPacked(["uint8", "bytes32", "uint256"], [1, cardanoBlocks[0].blockHash, 3]);

    const hash2 = ethers.keccak256(encoded);

    encoded = ethers.solidityPacked(["uint8", "bytes32", "uint256"], [1, cardanoBlocks[1].blockHash, 4]);

    const hash3 = ethers.keccak256(encoded);

    await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

    expect((await slots.getSlotsHashes()).length).to.equal(0);

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

    cardanoBlocks[0].blockSlot = 3;
    cardanoBlocks[1].blockSlot = 4;

    await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
    await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

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
    expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    // expect(await slots.numberOfVotes(hash2)).to.be.equal(3);
    // expect(await slots.hasVoted(hash3, validators[0].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash3, validators[1].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash3, validators[2].address)).to.be.equal(true);
    // expect(await slots.numberOfVotes(hash3)).to.be.equal(3);

    // await slots.connect(owner).pruneSlots(4, validatorsAddresses, 50);

    // expect((await slots.getSlotsHashes()).length).to.be.equal(2);
    // expect(await slots.hasVoted(hash0, validators[0].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash0, validators[1].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash0, validators[2].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash0, validators[3].address)).to.be.equal(false);
    // expect(await slots.numberOfVotes(hash0)).to.be.equal(0);
    // expect(await slots.hasVoted(hash1, validators[0].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash1, validators[1].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash1, validators[2].address)).to.be.equal(false);
    // expect(await slots.hasVoted(hash1, validators[3].address)).to.be.equal(false);
    // expect(await slots.numberOfVotes(hash1)).to.be.equal(0);
    // expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    // expect(await slots.numberOfVotes(hash2)).to.be.equal(3);
    // expect(await slots.hasVoted(hash2, validators[0].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash2, validators[1].address)).to.be.equal(true);
    // expect(await slots.hasVoted(hash2, validators[2].address)).to.be.equal(true);
    // expect(await slots.numberOfVotes(hash3)).to.be.equal(3);
  });
});
