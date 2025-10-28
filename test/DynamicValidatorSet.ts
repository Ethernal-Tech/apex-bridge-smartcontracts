import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Special Claims Contract", function () {
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
  describe("Submit new validator set", function () {
    it("Should revert if there is already a new validator set pending", async function () {
      const { bridge, owner, validatorsc, validators, validatorSets } = await loadFixture(deployBridgeFixture);

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());
      await validatorsc.connect(bridgeContract).setNewValidatorSetPending(true);

      await expect(
        bridge.connect(owner).submitNewValidatorSet(validatorSets, validators)
      ).to.be.revertedWithCustomError(bridge, "NewValidatorSetAlreadyPending");
    });

    it("Should revert if there is no new data set for all registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_notEnoughChains, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_notEnoughChains, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is too many data sets compared to registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_TooManyChains, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_TooManyChains, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfChains");
    });

    it("Should revert if there is not enough validators in the new validator set for all registered chains", async function () {
      const {
        bridge,
        owner,
        validators,
        chain1,
        chain2,
        validatorSets_NotEnoughValidators,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_NotEnoughValidators, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if there is too many validators in the new validator set for all registered chains", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_TooManyValidators, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_TooManyValidators, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("WrongNumberOfValidators");
    });

    it("Should revert if validator address is zero address", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_ZeroAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(
        bridge.connect(owner).submitNewValidatorSet(validatorSets_ZeroAddress, validators)
      ).to.be.revertedWithCustomError(bridge, "ZeroAddress");
    });

    it("Should revert if validator address is duplicated within a set", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets_DoubleAddress, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets_DoubleAddress, validators))
        .to.be.revertedWithCustomError(bridge, "InvalidData")
        .withArgs("DuplicatedValidator");
    });

    it("Should store addresses of validators to be removed from the new set", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.equal(0);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect((await validatorsc.getValidatorsToBeRemoved()).length).to.be.equal(validators.length);

      const validatorsToBeRemoved = await validatorsc.getValidatorsToBeRemoved();
      const validatorsToBeRemovedLenght = validatorsToBeRemoved.length;

      for (let i = 0; i < validatorsToBeRemovedLenght; i++) {
        expect(validatorsToBeRemoved[i]).to.be.equal(validators[i]);
      }
    });

    it("Should store proposed validator set", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect((await validatorsc.getNewValidatorSet()).length).to.be.equal(validatorSets.length);

      const newValidatorSet = await validatorsc.getNewValidatorSet();

      for (let i = 0; i < newValidatorSet.length; i++) {
        expect(newValidatorSet[i].chainId).to.be.equal(validatorSets[i].chainId);
        for (let j = 0; j < newValidatorSet[i].validators.length; j++) {
          expect(newValidatorSet[i].validators[j].addr.toLocaleLowerCase()).to.be.equal(
            validatorSets[i].validators[j].addr
          );
          expect(newValidatorSet[i].validators[j].keySignature).to.be.equal(
            validatorSets[i].validators[j].keySignature
          );
          expect(newValidatorSet[i].validators[j].keyFeeSignature).to.be.equal(
            validatorSets[i].validators[j].keyFeeSignature
          );
          for (let k = 0; k < newValidatorSet[i].validators[j].data.length; k++) {
            expect(newValidatorSet[i].validators[j].data.key[k]).to.be.equal(
              validatorSets[i].validators[j].data.key[k]
            );
          }
        }
      }
    });

    it("Should set newPendingValidatorSet to true when new ValidatorSet is submitted", async function () {
      const { bridge, validatorsc, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      expect(await validatorsc.newValidatorSetPending()).to.be.false;

      await bridge.connect(owner).submitNewValidatorSet(validatorSets, validators);

      expect(await validatorsc.newValidatorSetPending()).to.be.true;
    });
    it("Should emit newValidatorSetSubmitted when new ValidatorSet is submitted", async function () {
      const { bridge, owner, validators, chain1, chain2, validatorSets, validatorAddressChainData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);

      await expect(bridge.connect(owner).submitNewValidatorSet(validatorSets, validators)).to.emit(
        bridge,
        "newValidatorSetSubmitted"
      );
    });
  });

  describe("Submit new Signed Batch", function () {
    // it("Should skip if Batch Executed Claims is already confirmed", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEC,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["BEC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    //   await bridge.connect(validators[4]).submitClaims(validatorClaimsBEC);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    // });
    // it("Should skip if same validator submits the same Batch Executed Claim twice", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     signedBatch,
    //     validatorClaimsBEC,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["BEC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    // });
    // it("Should revert with BatchNotFound error if there is already a quorum for BEFC for the same batch", async function () {
    //   const {
    //     bridge,
    //     claims,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEC,
    //     validatorClaimsBEFC,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   // Create our claims with same batch ID but different purposes
    //   const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
    //   validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;
    //   // Group of validators submit original claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    //   // Group of validators submit modified claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
    //   // Calculate BEC hash
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
    //   const encodedBEC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEC.substring(2) +
    //     encodedPrefixBEC.substring(66);
    //   const hashBEC = ethers.keccak256(encoded40BEC);
    //   // Calculate BEFC hash
    //   const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
    //   const encodedBEFC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEFC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEFC.substring(2) +
    //     encodedPrefixBEFC.substring(66);
    //   const hashBEFC = ethers.keccak256(encoded40BEFC);
    //   // Verify that the hashes are different
    //   expect(hashBEC).to.not.equal(hashBEFC);
    //   // Verify that neither claim has reached quorum yet
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    //   // Try to reach quorum for first claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);
    //   // First claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);
    //   // Try to reach quorum for second claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);
    //   // Second claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    // });
    // it("Should revert with BatchNotFound error if there is already a quorum for another BEC for the same batch", async function () {
    //   const {
    //     bridge,
    //     claims,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEC,
    //     validatorClaimsBEC_another,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   // Create our claims with same batch ID but different purposes
    //   const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
    //   validatorClaimsBEC.batchExecutedClaims[0].batchNonceId = batchId;
    //   // Group of validators submit original claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    //   // Group of validators submit modified claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC_another);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC_another);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC_another);
    //   // Calculate BEC hash
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
    //   const encodedBEC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEC.substring(2) +
    //     encodedPrefixBEC.substring(66);
    //   const hashBEC = ethers.keccak256(encoded40BEC);
    //   // Calculate BEC_another hash
    //   const encodedPrefixBEC_another = abiCoder.encode(["string"], ["BEC"]);
    //   const encodedBEC_another = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC_another.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC_another.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC_another.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEC_another =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEC_another.substring(2) +
    //     encodedPrefixBEC_another.substring(66);
    //   const hashBEC_another = ethers.keccak256(encoded40BEC_another);
    //   // Verify that the hashes are different
    //   expect(hashBEC).to.not.equal(hashBEC_another);
    //   // Verify that neither claim has reached quorum yet
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    //   expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    //   // Try to reach quorum for first claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);
    //   // First claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);
    //   // Try to reach quorum for second claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC_another);
    //   // Second claim should not be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEC_another)).to.equal(3);
    // });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    // it("Should revert if chain is not registered", async function () {
    //   const { bridge, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeFixture);
    //   await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC)).to.be.revertedWithCustomError(
    //     bridge,
    //     "ChainIsNotRegistered"
    //   );
    // });
    // it("Should skip if Batch Execution Failed Claims is already confirmed", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEFC,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["BEFC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    //   await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    // });
    // it("Should skip if same validator submits the same Batch Execution Failed Claim twice", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     signedBatch,
    //     validatorClaimsBEFC,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["BEFC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    // });
    // it("Should skip if there is already a quorum for BRC for the same batch", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEC,
    //     validatorClaimsBEFC,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   // Create our claims with same batch ID but different purposes
    //   const batchId = validatorClaimsBEC.batchExecutedClaims[0].batchNonceId;
    //   validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;
    //   // Group of validators submit original claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
    //   // Group of validators submit modified claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
    //   // Calculate BEC hash
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefixBEC = abiCoder.encode(["string"], ["BEC"]);
    //   const encodedBEC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
    //       validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
    //       validatorClaimsBEC.batchExecutedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEC.substring(2) +
    //     encodedPrefixBEC.substring(66);
    //   const hashBEC = ethers.keccak256(encoded40BEC);
    //   // Calculate BEFC hash
    //   const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
    //   const encodedBEFC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEFC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEFC.substring(2) +
    //     encodedPrefixBEFC.substring(66);
    //   const hashBEFC = ethers.keccak256(encoded40BEFC);
    //   // Verify that the hashes are different
    //   expect(hashBEC).to.not.equal(hashBEFC);
    //   // Verify that neither claim has reached quorum yet
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(3);
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    //   // Try to reach quorum for first claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);
    //   // First claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEC)).to.equal(4);
    //   // Try to reach quorum for second claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);
    //   // Second claim should not be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    // });
    // it("Should revert with BatchNotFound error if there is already a quorum for another BEFC for the same batch", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain1,
    //     chain2,
    //     validatorClaimsBRC,
    //     validatorClaimsBEFC,
    //     validatorClaimsBEFC_another,
    //     signedBatch,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   // Register the chain
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
    //   await ethers.provider.send("evm_mine");
    //   await ethers.provider.send("evm_mine");
    //   const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
    //   expect(confirmedTxs.length).to.equal(1);
    //   expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   // Create our claims with same batch ID but different purposes
    //   const batchId = validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId;
    //   validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = batchId;
    //   // Group of validators submit original claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
    //   // Group of validators submit modified claim
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC_another);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC_another);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC_another);
    //   // Calculate BEC hash
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefixBEFC = abiCoder.encode(["string"], ["BEFC"]);
    //   const encodedBEFC = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEFC =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEFC.substring(2) +
    //     encodedPrefixBEFC.substring(66);
    //   const hashBEFC = ethers.keccak256(encoded40BEFC);
    //   // Calculate BEC_another hash
    //   const encodedPrefixBEFC_another = abiCoder.encode(["string"], ["BEFC"]);
    //   const encodedBEFC_another = abiCoder.encode(
    //     ["bytes32", "uint64", "uint8"],
    //     [
    //       validatorClaimsBEFC_another.batchExecutionFailedClaims[0].observedTransactionHash,
    //       validatorClaimsBEFC_another.batchExecutionFailedClaims[0].batchNonceId,
    //       validatorClaimsBEFC_another.batchExecutionFailedClaims[0].chainId,
    //     ]
    //   );
    //   const encoded40BEFC_another =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedBEFC_another.substring(2) +
    //     encodedPrefixBEFC_another.substring(66);
    //   const hashBEFC_another = ethers.keccak256(encoded40BEFC_another);
    //   // Verify that the hashes are different
    //   expect(hashBEFC).to.not.equal(hashBEFC_another);
    //   // Verify that neither claim has reached quorum yet
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(3);
    //   expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);
    //   // Try to reach quorum for first claim
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);
    //   // First claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEFC)).to.equal(4);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC_another);
    //   // First claim should now be confirmed
    //   expect(await claimsHelper.numberOfVotes(hashBEFC_another)).to.equal(3);
    // });
  });

  describe("Submit new Refund Request Claims", function () {
    // it("Should revert if chain is not registered", async function () {
    //   const { bridge, validators, validatorClaimsRRC } = await loadFixture(deployBridgeFixture);
    //   await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
    //     bridge,
    //     "ChainIsNotRegistered"
    //   );
    // });
    // it("Should skip if Refund Request Claims is already confirmed", async function () {
    //   const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
    //     [
    //       validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].originAmount,
    //       validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
    //       validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
    //       validatorClaimsRRC.refundRequestClaims[0].retryCounter,
    //       validatorClaimsRRC.refundRequestClaims[0].originChainId,
    //       validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedPrefix.substring(66) +
    //     encoded.substring(2);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    //   await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    // });
    // it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
    //   const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
    //   const encoded = abiCoder.encode(
    //     ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
    //     [
    //       validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].originAmount,
    //       validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
    //       validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
    //       validatorClaimsRRC.refundRequestClaims[0].retryCounter,
    //       validatorClaimsRRC.refundRequestClaims[0].originChainId,
    //       validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedPrefix.substring(66) +
    //     encoded.substring(2);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    // });
    // it("Should emit NotEnoughFunds and skip Refund Request Claim for failed BRC on destination if there is not enough funds", async function () {
    //   const { bridge, claims, owner, chain2, validators, validatorAddressChainData, validatorClaimsRRC } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain2, 1, validatorAddressChainData);
    //   validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
    //   const tx = await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
    //   const receipt = await tx.wait();
    //   const iface = new ethers.Interface([
    //     "event NotEnoughFunds(string claimeType, uint256 index, uint256 availableAmount)",
    //   ]);
    //   const event = receipt.logs
    //     .map((log) => {
    //       try {
    //         return iface.parseLog(log);
    //       } catch {
    //         return null;
    //       }
    //     })
    //     .filter((log) => log !== null)
    //     .find((log) => log.name === "NotEnoughFunds");
    //   expect(event).to.not.be.undefined;
    //   expect(event.fragment.name).to.equal("NotEnoughFunds");
    //   validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
    // });
    // it("Should revert if refundTransactionHash is not empty in Refund Request Claims", async function () {
    //   const {
    //     bridge,
    //     claimsHelper,
    //     owner,
    //     validators,
    //     chain2,
    //     validatorClaimsRRC,
    //     validatorClaimsRRC_wrongHash,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData);
    //   let abiCoder = new ethers.AbiCoder();
    //   let encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
    //   let encoded = abiCoder.encode(
    //     ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
    //     [
    //       validatorClaimsRRC.refundRequestClaims[0].originTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].refundTransactionHash,
    //       validatorClaimsRRC.refundRequestClaims[0].originAmount,
    //       validatorClaimsRRC.refundRequestClaims[0].outputIndexes,
    //       validatorClaimsRRC.refundRequestClaims[0].originSenderAddress,
    //       validatorClaimsRRC.refundRequestClaims[0].retryCounter,
    //       validatorClaimsRRC.refundRequestClaims[0].originChainId,
    //       validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet,
    //     ]
    //   );
    //   let encoded40 =
    //     "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedPrefix.substring(66) +
    //     encoded.substring(2);
    //   let hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    //   encoded = abiCoder.encode(
    //     ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
    //     [
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].originTransactionHash,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].refundTransactionHash,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].originAmount,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].outputIndexes,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].originSenderAddress,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].retryCounter,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].originChainId,
    //       validatorClaimsRRC_wrongHash.refundRequestClaims[0].shouldDecrementHotWallet,
    //     ]
    //   );
    //   encoded40 =
    //     "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    //     encodedPrefix.substring(66) +
    //     encoded.substring(2);
    //   hash = ethers.keccak256(encoded40);
    //   await expect(
    //     bridge.connect(validators[0]).submitClaims(validatorClaimsRRC_wrongHash)
    //   ).to.be.revertedWithCustomError(bridge, "InvalidData");
    // });
  });

  describe("Submit new Hot Wallet Increment Claim", function () {
    // it("Should revert if chain is not registered", async function () {
    //   const { bridge, validators, validatorClaimsHWIC } = await loadFixture(deployBridgeFixture);
    //   await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC)).to.be.revertedWithCustomError(
    //     bridge,
    //     "ChainIsNotRegistered"
    //   );
    // });
    // it("Should skip if Hot Wallet Increment Claim Claim is already confirmed", async function () {
    //   const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
    //   const encoded = abiCoder.encode(
    //     ["uint8", "uint256"],
    //     [
    //       validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
    //       validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000080" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);
    //   expect(
    //     await claimsHelper.hasVoted(
    //       "0x4ec43138854a8260f51de42ae197fcd87f5d22a6ea8499e1c0b261e1e4ffa575",
    //       validators[4].address
    //     )
    //   ).to.be.false;
    //   await bridge.connect(validators[4]).submitClaims(validatorClaimsHWIC);
    //   expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    // });
    // it("Should skip if same validator submits the same Hot Wallet Increment Claim twice", async function () {
    //   const { bridge, claimsHelper, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   const abiCoder = new ethers.AbiCoder();
    //   const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
    //   const encoded = abiCoder.encode(
    //     ["uint8", "uint256"],
    //     [
    //       validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId,
    //       validatorClaimsHWIC.hotWalletIncrementClaims[0].amount,
    //     ]
    //   );
    //   const encoded40 =
    //     "0x0000000000000000000000000000000000000000000000000000000000000060" +
    //     encoded.substring(2) +
    //     encodedPrefix.substring(66);
    //   const hash = ethers.keccak256(encoded40);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
    //   expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    // });
    // it("Should NOT increment totalQuantity if there is still no consensus on Hot Wallet Increment Claim", async function () {
    //   const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
    //   expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    // });
    // it("Should increment totalQuantity if there is consensus on Hot Wallet Increment Claim", async function () {
    //   const { bridge, claims, owner, validators, chain1, validatorClaimsHWIC, validatorAddressChainData } =
    //     await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
    //   expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(100);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsHWIC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsHWIC);
    //   expect(await claims.chainTokenQuantity(validatorClaimsHWIC.hotWalletIncrementClaims[0].chainId)).to.equal(
    //     100 + validatorClaimsHWIC.hotWalletIncrementClaims[0].amount
    //   );
    // });
  });
  describe("Claims getters/setters", function () {
    // it("Should revert if Claims SC resetCurrentBatchBlock is not called by Bridge SC", async function () {
    //   const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
    //   await expect(claims.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    // });
    // it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
    //   const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
    //   await expect(claims.connect(owner).setChainRegistered(1, 100)).to.be.revertedWithCustomError(bridge, "NotBridge");
    // });
    // it("Should revert if Claims SC setNextTimeoutBlock is not called by Bridge SC", async function () {
    //   const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
    //   await expect(claims.connect(owner).setNextTimeoutBlock(1, 100)).to.be.revertedWithCustomError(
    //     bridge,
    //     "NotBridge"
    //   );
    // });
    // it("Claims SC setVoted should revert if not called by Bridge SC", async function () {
    //   const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);
    //   await expect(
    //     claims
    //       .connect(owner)
    //       .setVoted(owner.address, "0x7465737400000000000000000000000000000000000000000000000000000000")
    //   ).to.be.revertedWithCustomError(bridge, "NotBridge");
    // });
    // it("Should revert claim submition in Claims SC if not called by bridge SC", async function () {
    //   const { bridge, claims, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);
    //   await expect(claims.connect(owner).submitClaims(validatorClaimsBRC, owner.address)).to.be.revertedWithCustomError(
    //     bridge,
    //     "NotBridge"
    //   );
    // });
    // it("getBatchTransactions should return txs from batch", async function () {
    //   const {
    //     bridge,
    //     owner,
    //     chain1,
    //     chain2,
    //     validators,
    //     validatorClaimsBRC,
    //     signedBatch,
    //     claims,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatch);
    //   const [status, txs] = await claims.getBatchStatusAndTransactions(signedBatch.destinationChainId, signedBatch.id);
    //   expect(txs).to.deep.equal([
    //     [
    //       validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
    //       BigInt(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId).toString(),
    //       0,
    //     ],
    //   ]);
    //   expect(status).to.equal(1);
    // });
    // it("getBatchTransactions should return empty tx if it is a consolidation batch", async function () {
    //   const {
    //     bridge,
    //     owner,
    //     chain1,
    //     chain2,
    //     validators,
    //     validatorClaimsBRC,
    //     signedBatchConsolidation,
    //     claims,
    //     validatorAddressChainData,
    //   } = await loadFixture(deployBridgeFixture);
    //   await bridge.connect(owner).registerChain(chain1, 1000, validatorAddressChainData);
    //   await bridge.connect(owner).registerChain(chain2, 1000, validatorAddressChainData);
    //   await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
    //   await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
    //   await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
    //   await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
    //   await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);
    //   const [status, txs] = await claims.getBatchStatusAndTransactions(
    //     signedBatchConsolidation.destinationChainId,
    //     signedBatchConsolidation.id
    //   );
    //   expect(txs).to.deep.equal([]);
    //   expect(status).to.equal(1);
    // });
  });
});
