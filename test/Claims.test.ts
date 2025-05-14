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
      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
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

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);

      await expect(
        bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_tooManyReceivers)
      ).to.be.revertedWithCustomError(bridge, "TooManyReceivers");
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination,
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
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        [
          "bytes32",
          "tuple(uint256, uint256, string)[]",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint8",
          "uint8",
        ],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination,
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1, 1000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination,
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
        .withArgs("BRC - Currency", 0, 1);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should skip Bridging Request Claim if there is not enough wrapped tokens and emit NotEnoughFunds event", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint256", "uint256", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource,
          validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination,
          validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination,
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
        .withArgs("BRC - Native Token", 0, 1);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should revert Bridging Request Claims if there are more than 32 in the array", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC_bunch32,
        validatorClaimsBRC_bunch33,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1, validatorAddressChainData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_bunch32);

      const hashes = [
        "0x0e3de34b9226ccc89d77c50f5bd4b5a5b210ee7f9a537853e29c52671feb7970",
        "0x29f1a754cc9ac0a5f21c262e68c1754620b1b37c7ff6bc88f310999d75962615",
        "0xcce35eb43fbee1abc09292fd710346ac295826c3b9bc2eceb02c287f89a69972",
        "0xf5da300435dff5bbc7ca24b0ef0b17bec24a424f83172c67ca357b02e782e3c5",
        "0xd740d57726715b321d0d6f3afa8e281616e786420ef64f0fe2c4c13270ad2c31",
        "0x2767a5b79e6cf5c1c4bfad4fb99f7ca13d06198b7d85e79882748d905a73a3bf",
        "0x26a0b820c6a61743af9a8e3d1667bbd092864a41cb577f5599176fd584b8fa3f",
        "0xf8bd4813c38bc8a36a87e057a28d4f1edac711d413a61f2d93a802dce2bfe679",
        "0xc2f2b11fcb24919d7e9c0e0ed2add5de6402c16efcc3da81dad30363faae8957",
        "0xdf94146b45abc6568eddbf2467c05fd7f7e24b0901509cace1b61f95d53f4df6",
        "0xd5ce250e0acc1070ea28179cdb172323d122ba52a341471fd2fd711f5c971a87",
        "0x4de873a20a045be3ca484046b15fe23bf0aa21d7dbf14b77c943215270905e33",
        "0x2e0a9c1e69b6a9e35710a2a8680a1d0cb02b83200b2b65b6215edf8ce74b7978",
        "0xfa96807cb29ede9b0dd694b3d0c36e229f70f1c4fe68d09b801c94459a6fa14a",
        "0x05e8293f9cb5ec4202567e42593c316cdb305c7143b51ddb2610ba359392893d",
        "0x96b773a3ce2a56cb9270b2bae0833463517ea846c4f7029a8d3c8048b1fd9252",
        "0xa22542b6bac5ceb4324bae1e743e1b9906ba9ff0d3704a7b4cb1563f17651858",
        "0x71ac2e9a51503d5069bd790f9f715a8eade573b680fd43636a8e3f877a4de8b0",
        "0xce2109c761c033d5bdcea90182dbb223c50d960c6f47600dceefb5aca42552d9",
        "0x501986a3d4cfb0e42bee9a08721fbcbe9aa16f7f3974d42f45dfc2c209a526be",
        "0x1e986af36820668358ea185acb2f0bad6b7a9419b08b78c0103fb038c383458f",
        "0x783a9098cb6582e320f440f04c6111760d9adaa5d81ee740b334fad0284eb3e5",
        "0xaa72cf536109bc0372253d6e7ffa436f95b6138023ea5a0e457236cd2194f29b",
        "0x3cba750d9866881a60111361e34079c628de742db41a171b447512af34dbf35b",
        "0x295fd2d0326b69ee3ebd3b336d936361177fce1a38adaeb4dd31b571c97866f9",
        "0x76b708a80b584fe55833fd83f98623a198832128fddb65314583a9ea60cb2e6a",
        "0xffa5043a934d6a012903721336adfe00f04152aff796af889552dcdf0abff26a",
        "0xb6d114a6bd5263ac5a7ea156540ee975c3da33f8f49c436e04bf8d8b8b499f14",
        "0x33876493d7e92b3af3035a961903ff4ad3d41d7f5a44cf00d40d0ad4ec70db87",
        "0x5846b09bd3e0273754312a76da23ee612bd96b8d89d5e972b7e7814cee2a95a6",
        "0xb1f5b1737995d5c11f3e6e1f64bc4097c36a257bc3c2a2e38fbbed5da3342ea5",
        "0x252f113638bd7af427a5c723459909f5180b1db2904d9aef2d8881494474305e",
      ];

      for (let i = 0; i < 16; i++) {
        expect(await claimsHelper.hasVoted(hashes[i], validators[0].address)).to.be.true;
        expect(await claimsHelper.numberOfVotes(hashes[i])).to.equal(1);
      }

      await expect(
        bridge.connect(validators[1]).submitClaims(validatorClaimsBRC_bunch33)
      ).to.be.revertedWithCustomError(bridge, "TooManyClaims");
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if signature is not valid", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, signedBatch, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);

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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
        claimsHelper,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      // Register the chain
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
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
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount,
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
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount,
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

      await bridge.connect(owner).registerChain(chain2, 1, 1, validatorAddressChainData);
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
    it("Should skip Refund Request Claim if there is not enough bridging tokens and emit NotEnoughFunds event", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsRRC_shouldDecrement,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, 1, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1, 1, validatorAddressChainData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originAmount,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originWrappedAmount,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originChainId,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC_shouldDecrement))
        .to.emit(claims, "NotEnoughFunds")
        .withArgs("RRC - Currency", 0, 1);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
    });
    it("Should skip Refund Request Claim if there is not enough bridging wrapped tokens and emit NotEnoughFunds event", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsRRC_shouldDecrement,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1, validatorAddressChainData);

      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originAmount,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originWrappedAmount,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].outputIndexes,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originSenderAddress,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].originChainId,
          validatorClaimsRRC_shouldDecrement.refundRequestClaims[0].shouldDecrementHotWallet,
        ]
      );

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC_shouldDecrement))
        .to.emit(claims, "NotEnoughFunds")
        .withArgs("RRC - Native Token", 0, 1);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
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

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      let abiCoder = new ethers.AbiCoder();
      let encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      let encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
        [
          validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].originAmount,
          validatorClaimsRRC.refundRequestClaims[0].originWrappedAmount,
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
      const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
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
      const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
      const encoded = abiCoder.encode(
        ["uint8", "uint256", "uint256"],
        [
          validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
          validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
          validatorClaimsHWIC.hotWalletIncrementClaims[0].amountWrapped,
        ]
      );

      const encoded40 =
        "0x0000000000000000000000000000000000000000000000000000000000000080" +
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

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);

      expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    });
    it("Should increment totalQuantity if there is consensus on Hot Wallet Increment Claim", async function () {
      const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
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
      await expect(claims.connect(owner).setChainRegistered(1, 100, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
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
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
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
