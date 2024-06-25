import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert claim submition in Claims SC if not called by bridge SC", async function () {
      const { bridge, claims, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).submitClaims(validatorClaimsBRC, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("Should revert if either source and destination chains are not registered", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, validatorClaimsBRC } = await loadFixture(
        deployBridgeFixture
      );

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Claims SC setVoted should revert if not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claims
          .connect(owner)
          .setVoted(owner.address, "0x7465737400000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should revert if Claims SC setTokenQuantity is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setTokenQuantity(1, 100)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC resetCurrentBatchBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setChainRegistered(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setNextTimeoutBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setNextTimeoutBlock(1, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("Should skip Bridging Request Claim if there is not enough bridging tokens", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1, validatorsCardanoData);

      validatorClaimsBRC.bridgingRequestClaims[0].totalAmount = 1000000;

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;

      validatorClaimsBRC.bridgingRequestClaims[0].totalAmount = 100;
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if signature is not valid", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3"); // should return false for precompile
      await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "InvalidSignature"
      );
    });

    it("Should revert if chain is not registered", async function () {
      const { bridge, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(
        claimsHelper,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if same validator submits the same Batch Executed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Batch Execution Failed Claims is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Execution Failed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
  });

  describe("Submit new Refund Request Claims", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsRRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Refund Request Claims is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
        [
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
          validatorClaimsRRC.refundRequestClaims[0].multisigSignature,
          validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].chainId,
          validatorClaimsRRC.refundRequestClaims[0].receiver,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
        [
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
          validatorClaimsRRC.refundRequestClaims[0].multisigSignature,
          validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].chainId,
          validatorClaimsRRC.refundRequestClaims[0].receiver,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
  });

  describe("Submit new Refund Executed Claim", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsREC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsREC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Refund Executed Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint8"],
        [
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash,
          validatorClaimsREC.refundExecutedClaims[0].refundTxHash,
          validatorClaimsREC.refundExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Executed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint8"],
        [
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash,
          validatorClaimsREC.refundExecutedClaims[0].refundTxHash,
          validatorClaimsREC.refundExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
  });
});
