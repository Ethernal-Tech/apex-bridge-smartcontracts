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

    it("Should revert if there is new validator set pending", async function () {
      const {
        bridge,
        owner,
        validators,
        chain1,
        chain2,
        validatorAddressChainData,
        validatorClaimsBRC,
        newValidatorSetDelta,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NewValidatorSetPending"
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
      const {
        bridge,
        claims,
        validatorsc,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();
      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BRC"
          "tuple(bytes32 observedTransactionHash,tuple(uint64 amount,string amount)[],uint256 totalAmountSrc,uint256 totalAmountDst,uint256 retryCounter,uint8 sourceChainId,uint8 destinationChainId)",
        ],
        [
          currentValidatorSetId,
          "BRC",
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
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const {
        bridge,
        claimsHelper,
        validatorsc,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);
      await bridge.connect(owner).registerChain(chain1, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorAddressChainData);

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();
      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BRC"
          "tuple(bytes32 observedTransactionHash,tuple(uint64 amount,string amount)[],uint256 totalAmountSrc,uint256 totalAmountDst,uint256 retryCounter,uint8 sourceChainId,uint8 destinationChainId)",
        ],
        [
          currentValidatorSetId,
          "BRC",
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
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

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

    it("Should revert if there are more than 32 claims in the array", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        validatorsc,
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

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();

      let hashes: string[] = [];

      for (let i = 0; i < validatorClaimsBRC_bunch32.bridgingRequestClaims.length; i++) {
        const encoded = abiCoder.encode(
          [
            "uint256", // currentValidatorSetId
            "string", // "BRC"
            "tuple(bytes32 observedTransactionHash,tuple(uint64 amount,string amount)[],uint256 totalAmountSrc,uint256 totalAmountDst,uint256 retryCounter,uint8 sourceChainId,uint8 destinationChainId)",
          ],
          [
            currentValidatorSetId,
            "BRC",
            [
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].observedTransactionHash,
              [
                [
                  validatorClaimsBRC_bunch32.bridgingRequestClaims[i].receivers[0].amount,
                  validatorClaimsBRC_bunch32.bridgingRequestClaims[i].receivers[0].destinationAddress,
                ],
              ],
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].totalAmountSrc,
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].totalAmountDst,
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].retryCounter,
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].sourceChainId,
              validatorClaimsBRC_bunch32.bridgingRequestClaims[i].destinationChainId,
            ],
          ]
        );

        const hash = ethers.keccak256(encoded);

        hashes.push(hash);
      }

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
        validatorsc,
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

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEC",
          [
            validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
            validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
            validatorClaimsBEC.batchExecutedClaims[0].chainId,
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for BEFC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        validatorsc,
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
      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encodedBEC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEC",
          [
            validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
            validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
            validatorClaimsBEC.batchExecutedClaims[0].chainId,
          ],
        ]
      );

      const hashBEC = ethers.keccak256(encodedBEC);

      // Calculate BEFC hash
      const encodedBEFC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEFC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEFC",
          [
            validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
          ],
        ]
      );

      const hashBEFC = ethers.keccak256(encodedBEFC);

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

    it("Should skip if there is already a quorum for another BEC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        validatorsc,
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

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC_another);

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encodedBEC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEC",
          [
            validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
            validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
            validatorClaimsBEC.batchExecutedClaims[0].chainId,
          ],
        ]
      );

      const hashBEC = ethers.keccak256(encodedBEC);

      // Calculate BEC_another hash
      const encodedBEC_another = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEC",
          [
            validatorClaimsBEC_another.batchExecutedClaims[0].observedTransactionHash,
            validatorClaimsBEC_another.batchExecutedClaims[0].batchNonceId,
            validatorClaimsBEC_another.batchExecutedClaims[0].chainId,
          ],
        ]
      );

      const hashBEC_another = ethers.keccak256(encodedBEC_another);

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
        validatorsc,
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

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEFC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEFC",
          [
            validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should skip if there is already a quorum for BRC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        validatorsc,
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

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encodedBEC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEC",
          [
            validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
            validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
            validatorClaimsBEC.batchExecutedClaims[0].chainId,
          ],
        ]
      );

      const hashBEC = ethers.keccak256(encodedBEC);

      const encodedBEFC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEFC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEFC",
          [
            validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
          ],
        ]
      );

      const hashBEFC = ethers.keccak256(encodedBEFC);

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

    it("Should skip if there is already a quorum for another BEFC for the same batch", async function () {
      const {
        bridge,
        claimsHelper,
        validatorsc,
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

      // Group of validators submit original claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      // Group of validators submit modified claim
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC_another);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC_another);

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encodedBEFC = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEFC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEFC",
          [
            validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
            validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
          ],
        ]
      );

      const hashBEFC = ethers.keccak256(encodedBEFC);

      // Calculate BEC_another hash
      const encodedBEFC_another = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "BEFC"
          "tuple(bytes32 observedTransactionHash, uint64 batchNonceId, uint8 chainId)",
        ],
        [
          currentValidatorSetId,
          "BEFC",
          [
            validatorClaimsBEFC_another.batchExecutionFailedClaims[0].observedTransactionHash,
            validatorClaimsBEFC_another.batchExecutionFailedClaims[0].batchNonceId,
            validatorClaimsBEFC_another.batchExecutionFailedClaims[0].chainId,
          ],
        ]
      );

      const hashBEFC_another = ethers.keccak256(encodedBEFC_another);

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

    it("Should revert if there is new validator set pending", async function () {
      const {
        bridge,
        validators,
        owner,
        chain1,
        chain2,
        validatorAddressChainData,
        newValidatorSetDelta,
        validatorClaimsRRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "NewValidatorSetPending"
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
      const {
        bridge,
        claimsHelper,
        validatorsc,
        owner,
        validators,
        chain2,
        validatorClaimsRRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "RRC"
          "tuple(bytes32 originTransactionHash, bytes32 refundTransactionHash, uint256 originAmount, bytes outputIndexes, string originSenderAddress, uint64 retryCounter, uint8 originChainId, bool shouldDecrementHotWallet)",
        ],
        [
          currentValidatorSetId,
          "RRC",
          [
            validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
            validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
            validatorClaimsRRC.refundRequestClaims[0].originAmount,
            validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
            validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
            validatorClaimsRRC.refundRequestClaims[0].retryCounter,
            validatorClaimsRRC.refundRequestClaims[0].originChainId,
            validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should emit NotEnoughFunds and skip Refund Request Claim for failed BRC on destination if there is not enough funds", async function () {
      const { bridge, owner, chain2, validators, validatorAddressChainData, validatorClaimsRRC } = await loadFixture(
        deployBridgeFixture
      );

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
        validatorsc,
        owner,
        validators,
        chain2,
        validatorClaimsRRC,
        validatorClaimsRRC_wrongHash,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      let encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "RRC"
          "tuple(bytes32 originTransactionHash, bytes32 refundTransactionHash, uint256 originAmount, bytes outputIndexes, string originSenderAddress, uint64 retryCounter, uint8 originChainId, bool shouldDecrementHotWallet)",
        ],
        [
          currentValidatorSetId,
          "RRC",
          [
            validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
            validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
            validatorClaimsRRC.refundRequestClaims[0].originAmount,
            validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
            validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
            validatorClaimsRRC.refundRequestClaims[0].retryCounter,
            validatorClaimsRRC.refundRequestClaims[0].originChainId,
            validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
          ],
        ]
      );

      let hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "RRC"
          "tuple(bytes32 originTransactionHash, bytes32 refundTransactionHash, uint256 originAmount, bytes outputIndexes, string originSenderAddress, uint64 retryCounter, uint8 originChainId, bool shouldDecrementHotWallet)",
        ],
        [
          currentValidatorSetId,
          "RRC",
          [
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].originTransactionHash,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].refundTransactionHash,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].originAmount,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].outputIndexes,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].originSenderAddress,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].retryCounter,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].originChainId,
            validatorClaimsRRC_wrongHash.refundRequestClaims[0].shouldDecrementHotWallet,
          ],
        ]
      );

      hash = ethers.keccak256(encoded);

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

    it("Should revert if there is new validator set pending", async function () {
      const {
        bridge,
        validators,
        owner,
        chain1,
        chain2,
        validatorAddressChainData,
        newValidatorSetDelta,
        validatorClaimsBRC,
        validatorClaimsHWIC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      bridge.connect(owner).submitNewValidatorSet(newValidatorSetDelta);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC)).to.be.revertedWithCustomError(
        bridge,
        "NewValidatorSetPending"
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
      const {
        bridge,
        claimsHelper,
        validatorsc,
        owner,
        validators,
        chain1,
        validatorClaimsHWIC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);

      const currentValidatorSetId = await validatorsc.currentValidatorSetId();

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        [
          "uint256", // currentValidatorSetId
          "string", // "HWIC"
          "tuple(uint8 chainId, uint256 amount)",
        ],
        [
          currentValidatorSetId,
          "HWIC",
          [
            validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
            validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
          ],
        ]
      );

      const hash = ethers.keccak256(encoded);

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
        signedBatch_Consolidation,
        claims,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch_Consolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch_Consolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch_Consolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch_Consolidation);

      const [status, txs] = await claims.getBatchStatusAndTransactions(
        signedBatch_Consolidation.destinationChainId,
        signedBatch_Consolidation.id
      );
      expect(txs).to.deep.equal([]);
      expect(status).to.equal(1);
    });
  });
});
