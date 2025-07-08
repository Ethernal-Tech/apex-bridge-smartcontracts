import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Claims Contract", function () {
  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if either source and destination chains are not registered", async function () {
      const { bridge, owner, validators, chain1, validatorAddressChainData, validatorClaimsBRC } = await loadFixture(
        deployBridgeFixture
      );
      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should revert if there are too many receivers in BRC", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorAddressChainData,
        validatorClaimsBRC_tooManyReceivers,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);

      await expect(
        bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_tooManyReceivers)
      ).to.be.revertedWithCustomError(bridge, "TooManyReceivers");
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountSrc,
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountDst,
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
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });
    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountSrc,
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountDst,
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
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountSrc,
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmountDst,
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

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC))
        .to.emit(claims, "NotEnoughFunds")
        .withArgs("BRC", 0, 1);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should revert Bridging Request Claims if there are more than 32 in the array", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC_bunch32,
        validatorClaimsBRC_bunch33,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_bunch32);

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

      for (let i = 0; i < 32; i++) {
        expect(await claims.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await expect(
        bridge.connect(validators[1]).submitClaims(validatorClaimsBRC_bunch33)
      ).to.be.revertedWithCustomError(bridge, "TooManyClaims");
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
        claims,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
        claims,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
      const { bridge, claims, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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

    it("Should emit NotEnoughFunds and skip Refund Request Claim for failed BRC on destination if there is not enough funds", async function () {
      const { bridge, claims, owner, chain2, validators, validatorAddressChainData, validatorClaimsRRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 1, validatorAddressChainData);
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
        validatorClaimsRRC_wrongHash,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
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
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].originAmount,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].originChainId,
          validatorClaimsRRC_wrongHash.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      hash = ethers.keccak256(encoded40);

      await expect(
        bridge.connect(validators[0]).submitClaims(validatorClaimsRRC_wrongHash)
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
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
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
        await claims.hasVoted(
          "0x4ec43138854a8260f51de42ae197fcd87f5d22a6ea8499e1c0b261e1e4ffa575",
          validators[4].address
        )
      ).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsHWIC);

      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Hot Wallet Increment Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
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
    it("Should NOT increment totalQuantity if there is still no consensus on Hot Wallet Increment Claim", async function () {
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    });
    it("Should increment totalQuantity if there is consensus on Hot Wallet Increment Claim", async function () {
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
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
    it("Claims SC setVotedOnlyIfNeededReturnQuorumReached should revert if not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
      await expect(
        claims
          .connect(owner)
          .setVotedOnlyIfNeededReturnQuorumReached(
            1,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            1
          )
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const [status, txs] = await claims.getBatchStatusAndTransactions(signedBatch.destinationChainId, signedBatch.id);
      expect(txs).to.deep.equal([
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId).toString(),
          0,
        ],
      ]);
      expect(status).to.equal(1);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      const [status, txs] = await claims.getBatchStatusAndTransactions(
        signedBatchConsolidation.destinationChainId,
        signedBatchConsolidation.id
      );
      expect(txs).to.deep.equal([]);
      expect(status).to.equal(1);
    });
  });
});
