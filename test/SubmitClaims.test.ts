import { loadFixture, setCode, reset } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Submit Claims", function () {
  const stakePoolIds = ["stakePoolId", "stakePoolId1", "stakePoolId2"];

  async function registerChainAndDelegate(bridge, owner, chain, validatorData, count = 2) {
      await bridge.connect(owner).registerChain(chain, 10000, 10000, validatorData);
      for (let i = 0; i < count; i++) {
      await bridge.connect(owner).delegateAddrToStakePool(chain.id, stakePoolIds[i]);
      }
  }

  describe("Submit new Bridging Request Claim", function () {
    it("Should revert any claim if not sent by validator", async function () {
      const { bridge, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should increase lastConfirmedTxNonce when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(0);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(1);
    });

    it("Should store new confirmedTransactions when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const destinationChainId = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
      const nonce = await claims.lastConfirmedTxNonce(destinationChainId);

      expect((await claims.confirmedTransactions(destinationChainId, nonce)).observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).sourceChainId).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).outputIndexes).to.equal("0x");
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).nonce).to.equal(nonce);
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalAmount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).totalWrappedAmount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amountWrapped
      );
      expect((await claims.confirmedTransactions(destinationChainId, nonce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
    });

    it("Should set voted on Bridging Request Claim", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
      const encoded = abiCoder.encode(
        [
          "bytes32",
          "tuple(uint64, uint64, string)[]",
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

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should update next timeout block when Bridging Request Claim is confirmed and requirements are met", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
      const currentBlock = await ethers.provider.getBlockNumber();

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        28
      );

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        35
      );
    });

    it("Should add requred amount of tokens on source chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1000);
      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1000);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1100);
      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1100);
    });

    it("Should add requred amount of wrapped tokens on source chain when Bridging Request Claim is confirmed and it is NOT a retry", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRCWrapped,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);

      expect(
        await claims.chainTokenQuantity(validatorClaimsBRCWrapped.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1000);
      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRCWrapped.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1000);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRCWrapped);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRCWrapped);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRCWrapped);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRCWrapped);

      expect(
        await claims.chainTokenQuantity(validatorClaimsBRCWrapped.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1000);
      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRCWrapped.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(1100);
    });

    it("Should NOT add requred amount of tokens on source chain when Bridging Request Claim is confirmed and it is a retry", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1000);

      validatorClaimsBRC.bridgingRequestClaims[0].retryCounter = 1;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      validatorClaimsBRC.bridgingRequestClaims[0].retryCounter = 0;

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1000);
    });

    it("Should remove requred amount of tokens from destination chain when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1000);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        900
      );
    });

    it("Should update nextTimeoutBlock when Bridging Request Claim is confirmed and conditions are met", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[4]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId);
      expect(confBatch.bitmap).to.equal(27);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should set voted on Bridging Executed Claim", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
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

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should set status executed for confirmed signed batch after reaching quorum on Bridging Executed Claim", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
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

      const confSignedBatchDataPrev = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEC.batchExecutedClaims[0].chainId,
        validatorClaimsBEC.batchExecutedClaims[0].batchNonceId
      );
      expect(confSignedBatchDataPrev.firstTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.lastTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.status).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const confSignedBatchData = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEC.batchExecutedClaims[0].chainId,
        validatorClaimsBEC.batchExecutedClaims[0].batchNonceId
      );
      expect(confSignedBatchData.firstTxNonceId).to.equal(1);
      expect(confSignedBatchData.lastTxNonceId).to.equal(1);
      expect(confSignedBatchData.status).to.equal(2);
    });

    it("Should set status failed for confirmed signed batch after reaching quorum on Bridging Executed Claim", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEFC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
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

      const confSignedBatchDataPrev = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId
      );
      expect(confSignedBatchDataPrev.firstTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.lastTxNonceId).to.equal(1);
      expect(confSignedBatchDataPrev.status).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const confSignedBatchData = await claimsHelper.getConfirmedSignedBatchData(
        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId
      );
      expect(confSignedBatchData.firstTxNonceId).to.equal(1);
      expect(confSignedBatchData.lastTxNonceId).to.equal(1);
      expect(confSignedBatchData.status).to.equal(3);
    });

    it("Should update lastBatchedTxNonce when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId);
      expect(confBatch.bitmap).to.equal(15);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      const lastNonceBefore = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonceBefore).to.equal(0);

      // quorum reached!
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastNonce = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonce).to.equal(1);
    });

    it("Should reset currentBatchBlock when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should not update nextTimeoutBlock when Bridging Excuted Claim contains a consolidation batch", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatchConsolidation,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.lessThan(currentBlock);
    });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should set voted on Bridging Execution Failed Claim", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 10000, 10000, validatorAddressChainData);
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

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should reset currentBatchBlock when Bridging Executed Failed Claim is confirmed", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Failed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should not update nextTimeoutBlock when Bridging Excuted Failed Claim containis consolidation batch", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatchConsolidation,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatchConsolidation);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatchConsolidation);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.lessThan(currentBlock);
    });

    it("Should update lastBatchedTxNonce when Bridging Excuted Failed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claims.lastBatchedTxNonce(_destinationChain)).to.equal(0);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.lastBatchedTxNonce(_destinationChain)).to.equal(1);
    });
    it("Should increase chainTokenQuantity and chainWrappedTokenQuantity for destination chain when Bridging Excuted Failed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      const chain2TokenQuantityStart = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityStart = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const chain2TokenQuantityBefore = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityBefore = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const chain2TokenQuantityAfter = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      const chain2WrappedTokenQuantityAfter = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      expect(chain2TokenQuantityAfter).to.be.equal(
        chain2TokenQuantityBefore + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );
      expect(chain2TokenQuantityAfter).to.be.equal(chain2TokenQuantityStart);

      expect(chain2WrappedTokenQuantityAfter).to.be.equal(
        chain2WrappedTokenQuantityBefore + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );
      expect(chain2WrappedTokenQuantityAfter).to.be.equal(chain2WrappedTokenQuantityStart);
    });
  });

  describe("Submit new Refund Request Claims", function () {
    it("Should set voted on Refund Request Claim", async function () {
      const { bridge, claims, owner, chain2, validators, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      const abiCoder = new ethers.AbiCoder();
      const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint256", "uint256", "bytes", "string", "uint64", "uint8", "bool", "uint8"],
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
          validatorClaimsRRC.refundRequestClaims[0].destinationChainId,
        ]
      );

      const encoded40 =
        "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
        encodedPrefix.substring(66) +
        encoded.substring(2);

      const hash = ethers.keccak256(encoded40);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claims.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claims.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should store new confirmedTransactions when Refund Request Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain2,
        validatorClaimsBRC,
        validatorClaimsRRC,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      const chainID = validatorClaimsRRC.refundRequestClaims[0].originChainId;

      const nonce = await claims.lastConfirmedTxNonce(chainID);

      expect((await claims.confirmedTransactions(chainID, nonce)).sourceChainId).to.equal(
        validatorClaimsRRC.refundRequestClaims[0].originChainId
      );
      expect((await claims.confirmedTransactions(chainID, nonce)).nonce).to.equal(nonce);
      expect((await claims.confirmedTransactions(chainID, nonce)).outputIndexes).to.equal(
        validatorClaimsRRC.refundRequestClaims[0].outputIndexes
      );
      expect((await claims.confirmedTransactions(chainID, nonce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
    });

    it("Should not change Hot Wallet status when Refund Request Claims is confirmed (wrong metadata, not enough funds)", async function () {
      const { bridge, claims, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const hotWalletState = await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        hotWalletState
      );
    });
    it("Should decrease Hot Wallet status when Refund Request Claims has shouldDecrementHotWallet set to true and it is 0 retry", async function () {
      const { bridge, claims, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;

      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const hotWalletState =
        (await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId)) -
        BigInt(validatorClaimsRRC.refundRequestClaims[0].originAmount);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        hotWalletState
      );
      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
    });

    it("Should not decrease Hot Wallet status when Refund Request Claims has shouldDecrementHotWallet set to true and it is NOT 0 retry", async function () {
      const { bridge, claims, owner, validators, chain2, validatorClaimsRRC, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 1;

      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const hotWalletState = await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsRRC.refundRequestClaims[0].originChainId)).to.equal(
        hotWalletState
      );

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 0;
    });

    it("Use Case 1: BRC -> BEFC -> RRC", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        validatorClaimsRRC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      let hotWalletStateOriginalSource = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletWrappedStateOriginalSource = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletStateOriginalDestination = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let hotWalletWrappedStateOriginalDestination = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination -
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalDestination -
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination)
      );

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(hotWalletWrappedStateOriginalDestination);

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = false;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain2.id;
    });

    it("Use Case 2: BRC -> BEFC -> RRC -> BEFC -> RRC -> BEFC", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        validatorClaimsRRC,
        signedBatch,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, 1000, validatorAddressChainData);
      await bridge.connect(owner).registerChain(chain2, 1000, 1000, validatorAddressChainData);
      let hotWalletStateOriginalSource = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletWrappedStateOriginalSource = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );

      let hotWalletStateOriginalDestination = await claims.chainTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      let hotWalletWrappedStateOriginalDestination = await claims.chainWrappedTokenQuantity(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId
      );

      // --- START BRC ---

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination -
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalDestination -
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination)
      );

      // --- END BRC ---

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 1 ---

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource + BigInt(validatorClaimsBRC.bridgingRequestClaims[0].nativeCurrencyAmountSource)
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)
      ).to.equal(
        hotWalletWrappedStateOriginalSource +
          BigInt(validatorClaimsBRC.bridgingRequestClaims[0].wrappedTokenAmountSource)
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      expect(
        await claims.chainWrappedTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(hotWalletWrappedStateOriginalDestination);

      // --- END BEFC 1 ---

      // --- START RRC 1 ---

      validatorClaimsRRC.refundRequestClaims[0].shouldDecrementHotWallet = true;
      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END RRC 1 ---

      signedBatch.id = 1;
      signedBatch.firstTxNonceId = 1;
      signedBatch.lastTxNonceId = 1;
      signedBatch.destinationChainId = chain1.id;

      // wait for next timeout
      for (let i = 0; i < 4; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 2 ---

      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 2;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 1;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END BEFC 2 ---

      // --- START RRC 2 ---

      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 1;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END RRC 2 ---

      signedBatch.id = 2;
      signedBatch.firstTxNonceId = 2;
      signedBatch.lastTxNonceId = 2;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      // --- START BEFC 3 ---

      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 2;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(
        hotWalletStateOriginalSource
      );

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        hotWalletStateOriginalDestination
      );

      // --- END BEFC 3 ---

      validatorClaimsRRC.refundRequestClaims[0].originChainId = chain2.id;
      validatorClaimsRRC.refundRequestClaims[0].retryCounter = 0;
      validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId = 1;
      signedBatch.id = 1;
      signedBatch.firstTxNonceId = 1;
      signedBatch.lastTxNonceId = 1;
    });  
  });

  describe("Submit new Stake Delegation Batch Executed Claims", function () {
    it("Should not create batch when no unbatched txs exist", async function () {
        const { bridge, claims, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData, validatorClaimsBEC } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 2);

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDel);
        }

        validatorClaimsBEC.batchExecutedClaims[0].chainId = chain1.id;
        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitClaims(validatorClaimsBEC);
        }

        expect(await claims.getLastBatchedStakeDelTxNonce(chain1.id)).to.equal(2);
        expect(await claims.shouldCreateStakeDelBatch(chain1.id)).to.be.false;
    });

    it("Should return remaining stake delegation txs after executed batch", async function () {
        const { bridge, claims, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData, validatorClaimsBEC } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 3);

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDel);
        }

        const lastNonceBefore = await claims.getLastBatchedStakeDelTxNonce(chain1.id);
        expect(lastNonceBefore).to.equal(0);

        validatorClaimsBEC.batchExecutedClaims[0].chainId = chain1.id;
        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitClaims(validatorClaimsBEC);
        }

        const lastNonce = await claims.getLastBatchedStakeDelTxNonce(chain1.id);
        expect(lastNonce).to.equal(2);

        const stakeDelTxs = await bridge.getStakeDelegationTransactions(chain1.id);
        expect(stakeDelTxs.length).to.equal(1);

        expect(stakeDelTxs[0].chainId).to.equal(chain1.id);
        expect(stakeDelTxs[0].stakePoolId).to.equal(stakePoolIds[2]);
        expect(stakeDelTxs[0].nonce).to.equal(3);
    });
  });

  describe("Submit new Stake Delegation Batch Execution Failed Claims", function () {
    it("Should return stake delegation txs if previous batch failed", async function () {
        const { bridge, claims, claimsHelper, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData, validatorClaimsBEFC } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 2);

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDel);
        }

        const lastNonceBefore = await claims.getLastBatchedStakeDelTxNonce(chain1.id);
        expect(lastNonceBefore).to.equal(0);

        validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId = chain1.id;
        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitClaims(validatorClaimsBEFC);
        }

        const lastNonce = await claims.getLastBatchedStakeDelTxNonce(chain1.id);
        expect(lastNonce).to.equal(2);

        const stakeDelTxs = await bridge.getStakeDelegationTransactions(chain1.id);
        expect(stakeDelTxs.length).to.equal(2);

        expect(stakeDelTxs[0].chainId).to.equal(chain1.id);
        expect(stakeDelTxs[0].stakePoolId).to.equal(stakePoolIds[0]);
        expect(stakeDelTxs[0].nonce).to.equal(3);

        expect(stakeDelTxs[1].chainId).to.equal(chain1.id);
        expect(stakeDelTxs[1].stakePoolId).to.equal(stakePoolIds[1]);
        expect(stakeDelTxs[1].nonce).to.equal(4);

        expect(await claimsHelper.lastStakeDelegationTxNonce(chain1.id)).to.equal(4);
    });
  });
});
