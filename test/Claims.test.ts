import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
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
    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
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
      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);
      const hash = ethers.keccak256(encoded40);
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
      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
    it("Should skip Bridging Request Claim if there is not enough bridging tokens and emit NotEnoughFunds event", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
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

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC))
        .to.emit(claims, "NotEnoughFunds")
        .withArgs("BRC", 0, 1);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should skip Bridging Request Claims if there are more than 16 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRCBunch16,
        validatorClaimsBRCBunch17,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRCBunch16);

      const hashes = [
        "0x9c7d76ea19efbeccf02a1fd85fd9471b9075e99a329a80eeb7ae4d145c7eff66",
        "0xc607faa089b0d6d690dbdc5d6f8cc4558d37b75d9393c998812c56a7f14387ce",
        "0x136416f90a3950212c37c1eaf39ab2ea7530222ce02b3c64f7c60918ae3d4945",
        "0x107b0f5d128bb478cd3a7e7074e2a06507ceb7a3daac7940d8c511c914ce39b2",
        "0xe09d26f8d9f703ca3e66b3d32fe9c2dfefba08de6e05a8e3f86f259dbb3b38fb",
        "0xbe5dcc66171801ef3f1ea37043b0900e3fc68c9f201478553c7c38d82d245978",
        "0x84de0a9358ae5e19548f202f3ae8f2f0e607379a8a943ab52d4dd86fd354e54d",
        "0xe594e8c9532b8b5b22789b71bf23ae801d095b35738ee127d868d0ca8a1bd3e8",
        "0xe30de87be001a88b98b725ee957df6eea2b79e3fe6b91ae118db1ddbeaef9ace",
        "0x895f1d256f4e8f7c0398e82e497e9d478e673195e120a8a6c4646cb9615eb400",
        "0xc614c3121867aab6bd1f3c59db37979345ff725ec0890f731460d94d4a0bd500",
        "0xbcc7c2f82fdc4848d88b81a9c785976160146a7aeffd07ac1abf39b23deb5ba2",
        "0xee8a1bdd0398ad222ba7c422771ed174963a317f05fa1dc26506da061082dafd",
        "0xb485cf028121cd2f557e4c6021dbe5ea1100b1166e4d1b51a5b5214643446803",
        "0xc58fc17ba75fa3bd74385becdca4f88aea55b1928a7353e3ed09ab28dacc9dd0",
        "0x58ed858c84cdb8f0c63006d80142dfa24cbfe58a78d01cdc63d26f2055738f8d",
        "0x101711d516b9a711d2d6b96a8a9b65f21bc251070e7a11cdb4fc809d5e039728",
      ];

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRCBunch17);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[1].address)).to.be.false;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(
        claimsHelper,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Batch Executed Claims is already confirmed", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Executed Claim twice", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for BEFC for the same batch", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Calculate BEC hash
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
      const encodedBEC = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );
      const encoded40BEC =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEC.substring(2) +
        encodedPrefixBEC.substring(66);
      const hashBEC = ethers.keccak256(encoded40BEC);

      // Calculate BEFC hash
      const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
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

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // Second claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for another BEC for the same batch", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEC,
        validatorClaimsBEC_another,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
      validatorClaimsBEC.batchExecutedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC_another);

      // Calculate BEC hash
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
      const encodedBEC = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );
      const encoded40BEC =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEC.substring(2) +
        encodedPrefixBEC.substring(66);
      const hashBEC = ethers.keccak256(encoded40BEC);

      // Calculate BEC_another hash
      const encodedPrefixBEC_another = abiCoder.encode(["string"], ["BEC"]);
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
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC_another);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    });
    it("Should skip Batch Executed Claims if there are more than 16 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBECBunch16,
        validatorClaimsBECBunch17,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const hashes = [
        "0xf7cfe206a07418f729a41b08776a354931b0cc3f7a775bb5fef4acf8d5411abf",
        "0xe45fb8b54d5e212844aa951d0ff152d7b58c87d035ea8d1390e245e063bf65df",
        "0xfc5f175e9798b01cbf7f0fe94c65132aba9bf257f6eda48f3e10a67ee7640cba",
        "0xf2b9084056b0eb4e363e70e1198a30b0f74efeec109a76fdc0598e8e94df9855",
        "0x3ace2f25e6727d0eeb9feb7fafb1bbaa0f13d111365c5bf30c38b4f1c6c4b266",
        "0xbb8ffda53b85246c5c35bbe19b7233a2e81b1d5845510df2565f63011435f82a",
        "0x6657feaa278f156df014fd5cef24b92deb43c42d34410629a47d5a5976e4d493",
        "0x775107ad23b4cca1a65ef850ad1a3dab621f0d9aaa8aaa8f0a56826daea6a257",
        "0xa5dcac441a44feb18365f79deaaf3ab051ec4030284818431e3f2ece8a899a8a",
        "0xa4ab9c892170c8653d72a2afd80328a5013dc71bee96d1fd37485cf315cb8d85",
        "0xb14c35789454500774f3cbd07599f73b40b68028f0e98ee11a80154841fbc200",
        "0x12bc6776e11122aa0babc7ba68bf513c8b22c57a6f630b0bf19f9515150b9ca3",
        "0x091c6cfc4092a6b92f3d45c324fe33b899b7f5c8aa360d93c37b518b8ebdc387",
        "0x0b3acb6b8ff464fcc9cc635530451e583cf9651e5bf1c1e69cd539a98101ca43",
        "0xbeecead1c9f7c94a6f125afd4b76f00947a5787c80e3fea9f52954e3cd89c29a",
        "0xa9c00537b584620b49957364d208932c8e54d838023121ee11399b9d559ae773",
        "0x3e892a34059ac052c896a8512f8b80e9c2953847975db2d76fdd9f338a8dd116",
      ];

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBECBunch16);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await bridge.connect(validators[1]).submitClaims(validatorClaimsBECBunch17);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[1].address)).to.be.false;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }
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
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

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

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Execution Failed Claim twice", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEFC,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for BRC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Calculate BEC hash
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
      const encodedBEC = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );
      const encoded40BEC =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEC.substring(2) +
        encodedPrefixBEC.substring(66);
      const hashBEC = ethers.keccak256(encoded40BEC);

      // Calculate BEFC hash
      const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
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

      // Verify that the hashes are different
      expect(hashBEC).to.not.equal(hashBEFC);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);

      // Try to reach quorum for second claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // Second claim should not be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    });
    it("Should revert with BatchNotFound error if there is already a quorum for another BEFC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        validatorClaimsBEFC_another,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      // Create our claims with same batch ID but different purposes
      const batchId = validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC_another);

      // Calculate BEC hash
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
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

      // Calculate BEC_another hash
      const encodedPrefixBEFC_another = abiCoder.encode(["string"], ["BEFC"]);
      const encodedBEFC_another = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC_another.batchExecutionFailedClaims[0].chainId,
        ]
      );
      const encoded40BEFC_another =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encodedBEFC_another.substring(2) +
        encodedPrefixBEFC_another.substring(66);
      const hashBEFC_another = ethers.keccak256(encoded40BEFC_another);

      // Verify that the hashes are different
      expect(hashBEFC).to.not.equal(hashBEFC_another);

      // Verify that neither claim has reached quorum yet
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
      expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);

      // Try to reach quorum for first claim
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC_another);

      // First claim should now be confirmed
      expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);
    });
    it("Should skip Batch Executed Failed Claims if there are more than 16 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFCBunch16,
        validatorClaimsBEFCBunch17,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const hashes = [
        "0x641d6a990651f3f65551ce817fec8c49f973cb93a92688a96bde6df5fddd6abf",
        "0x27b7fac2b4468460d4ceb6b77c4e797c7e55489e5c1dc3fad631c25030c1074d",
        "0xd9c519e586390a3e9f97dec7260ad4e686e9275561d49c4e3f487dc2762c1cca",
        "0x8e099da61190b04776f744f6eb7ed0c3528a450012224bfaddbd93de75a67d55",
        "0x645652e5e3de24e5b92ecbba6322d153fb9a0de24ed4f005c0916eccdc465ae8",
        "0x14a92a87cb7eff97a5330f08a71965a8ce0341281d3048928095eeeb27fab89b",
        "0xa218c31507b349fa3a90ac64e70a7ac392ae1caf8ed704de58e920a376fa2863",
        "0x5ccd87119706a8811ca3b3611475b432596e1156731948bb69e0ac5808e03f2e",
        "0xb04065f5858dfe6a09ab267000c859b2bed87ddff98b833f52916d50b15a5db1",
        "0x5ce1350ec39e31dbbcc41fac9d29f030f14767934b681349e257a5d852bf85c1",
        "0x56963a96b2dc51bd4de889a5bc2132107914491516ceed4a305af8c1e503e1d0",
        "0x93ccc720294a7a77ca57d26ba0e9b767773b4fe94c0a88487f393c94e698ffc2",
        "0x2f30d3335b13433f8c26b8a6679eb0ddd2d5ba03ae32b0d1f243e1e15bcde1f1",
        "0xb6cfd7bc03615e967d305b8e1e5fd8a1f6899226f72a0f0263c673e1cba6be28",
        "0x018a3ece9fba1ee42d4d4695f006328641e8c43f1eaf78d962d9647f824c77b0",
        "0xa7fed8a23f900b88bbaeda6e1065e8d43cb38f9e2e370ec0e22a7c4d0dc74b91",
      ];

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFCBunch16);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFCBunch17);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[1].address)).to.be.false;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }
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
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].originChainId,
          validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

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
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].originChainId,
          validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
    it("Should skip Refund Request Claims if there are more than 16 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsRRCBunch16,
        validatorClaimsRRCBunch17,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const hashes = [
        "0xdaab3107dba96637cd3db84b89f26c71419c2133442d15b9057e313d705b6bdd",
        "0xe7ab30a3ac72e56cfcb383623d0e52c1ba174237194518e9707ff84f599db3dd",
        "0x29023b271ae2efcceae986e8e9cf10ff389f048acfb0d5c8fceb8e2624629574",
        "0x1e9f2e137c8a4953c29ed26aeb6d3eec9763d74a47e7b9f7a0c0e7e36268732d",
        "0x960dfa3dfda7a195839cdc70ea2a692c9cacc4cd2daa1f926f5714f8d59bac14",
        "0xabaf648bc0e593e052745d7150445b73c039fb24455e209f57031a95364c8e3b",
        "0xe0dbd2fe1ae3c605157f7743efd8e4fddfd1a3bb8d10bf26bed6aad42a995d6b",
        "0xbfe68b35550087f2e87e1468f567c019376d240057722393524d6d806919f807",
        "0x0f0b73a3075a3b49d33a0eb447425d99f1c5e4c2dffa1f44ea75b62ebd37c2fd",
        "0xcd5eb946f0fdfb60e3ce44bdab1382759a983bd2f714acbf50470140481f717b",
        "0xcb1f64cd40abdfe34d7b53a586e6bd766c13f040996f16af74c8bc14c61389e6",
        "0x1f69cc288bc0f509a48449dc9762699c8daa54104d6ccf04c0c55b46962f92a7",
        "0x8257dc973152b9aebee70991353f1186ee938b0620c60387474df5a870e70c60",
        "0x41cdb8a572764404faa547861890049b907afb1499a9bc8278b7d47c5fa7877f",
        "0x00aba1803af3b5ecd89842968500c73e445978cb206428dba83959c695d1840e",
        "0xc6340212e2624e260ff8f2eeb38ed03a97a054220fd8369bdc2293fb68c0e49c",
      ];

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRCBunch16);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRCBunch17);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[1].address)).to.be.false;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }
    });
    it("Should emit NotEnoughFunds and skip Refund Request Claim for failed BRC on destination if there is not enough funds", async function () {
      const { bridge, claims, owner, chain2, validators, validatorsCardanoData, validatorClaimsRRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 1, validatorsCardanoData);

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const tx = await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      const receipt = await tx.wait();

      const iface = new ethers.Interface([
        "event NotEnoughFunds(string claimeType, uint256 index, uint256 availableAmount)",
      ]);

      const event = receipt.logs
        .map((log) => {
          try {
            return iface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((log) => log !== null)
        .find((log) => log.name === "NotEnoughFunds");

      expect(event).to.not.be.undefined;
      expect(event.fragment.name).to.equal("NotEnoughFunds");

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
    });
    it("Should revert if refundTransactionHash is not empty in Refund Request Claims", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        chain2,
        validatorClaimsRRC,
        validatorClaimsRRCwrongHash,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      let abiCoder = new ethers.AbiCoder();
      let encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      let encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].originChainId,
          validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      let encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      let hash = ethers.keccak256(encoded40);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRCwrongHash.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].originAmount,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].retryCounter,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].originChainId,
          validatorClaimsRRCwrongHash.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      hash = ethers.keccak256(encoded40);

      await expect(
        bridge.connect(validators[0]).submitClaims(validatorClaimsRRCwrongHash)
      ).to.be.revertedWithCustomError(bridge, "InvalidData");
    });
  });

  describe("Submit new Hot Wallet Increment Claim", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsHWIC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Hot Wallet Increment Claim Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
      const encoded = abiCoder.encode(
        ["uint8", "uint256"],
        [
          validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
          validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);

      expect(
        await claimsHelper.hasVoted(
          "0x4ec43138854a8260f51de42ae197fcd87f5d22a6ea8499e1c0b261e1e4ffa575",
          validators[4].address
        )
      ).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsHWIC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Hot Wallet Increment Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
      const encoded = abiCoder.encode(
        ["uint8", "uint256"],
        [
          validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
          validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000060" +
        encoded.substring(2) +
        encodedPrefix.substring(66);

      const hash = ethers.keccak256(encoded40);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });
    it("Should skip Hot Wallet Increment Claims if there are more than 16 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsHWICBunch16,
        validatorClaimsHWICBunch17,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWICBunch16);

      const hashes = [
        "0x4ec43138854a8260f51de42ae197fcd87f5d22a6ea8499e1c0b261e1e4ffa575",
        "0x7395af495d140732946b871541531af0d50ccde1c77de1590dc39e5f297d9ef1",
        "0x2feed2b1978cfdc6b7561a03f0da87b417887e7978e5514b373d9239df8adcdf",
        "0xa13b8a1530bee447462068dc6c11d24763f7474bcf3d7448a36256fce2fe39dc",
        "0x4e5a4e378fbc1e57beace02b507ff3b6cd9bc6e3d78d64bed1f07e6b02461750",
        "0xf6c63d406604663ba83fba2fcd90a4b0d637a71568f111ad0f4abc9d42b59907",
        "0xc7f95ef7a8bb5bde32eb841f3b41cb3c1508d3e468a419020dc07f056f293ab1",
        "0x82c15ae63bc56752b40c0fb60db928fdd172b8a8956a8846e86abb9098e8ed06",
        "0x80cd2a6698d1cadcd7db564da9d3fce624f2719debe11f39dfe29fd50522b0e3",
        "0xd6c071c575270998514023a9d8b47777750b432483fdbfc0c5a5ff436f34a78e",
        "0x64345855c0afe505defeaa7a28500d5bf714be843ec87435e4e92cff2aa76b64",
        "0x9e1feae4e34903175b82ff9f05a04b0dbb41554c7abe93aa9524c2b10f1c4acc",
        "0x16f64ae2d5d11eabdd558f942349692da1c8c32106416209b199044b06cc198f",
        "0x9447d0405e7dce8b38d3d36922dd6b3e8f2586db4e0828cdd44304473920bf84",
        "0xe93c608985589af07f04920c359d711a39f3fc5dc8c37fe8314bcf8c959686c0",
        "0x4c93af92c9687540cdd8519768d4e670ac895bcd9579b732709fb5d396f6c9be",
      ];

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWICBunch17);

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[1].address)).to.be.false;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }
    });
    it("Should NOT increment totalQuantity if there is still no consensus on Hot Wallet Increment Claim", async function () {
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    });
    it("Should increment totalQuantity if there is consensus on Hot Wallet Increment Claim", async function () {
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(
        100 + validatorClaimsHWIC.hotWalletIncrementClaims[0].amount
      );
    });
  });
  describe("Claims getters/setters", function () {
    it("Should revert if Claims SC resetCurrentBatchBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
      await expect(claims.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });
    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
      await expect(claims.connect(owner).setChainRegistered(1, 100)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });
    it("Should revert if Claims SC setNextTimeoutBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
      await expect(claims.connect(owner).setNextTimeoutBlock(1, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
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
    it("Should revert claim submition in Claims SC if not called by bridge SC", async function () {
      const { bridge, claims, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);
      await expect(claims.connect(owner).submitClaims(validatorClaimsBRC, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });
    it("getBatchTransactions should return txs from batch", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        claims,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const txs = await claims.getBatchTransactions(signedBatch.destinationChainId, signedBatch.id);
      expect(txs).to.deep.equal([
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId).toString(),
          0,
        ],
      ]);
    });

    it("getBatchTransactions should return empty tx if it is a consolidation batch", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatchConsolidation,
        claims,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      const txs = await claims.getBatchTransactions(
        signedBatchConsolidation.destinationChainId,
        signedBatchConsolidation.id
      );
      expect(txs).to.deep.equal([]);
    });
  });
});
