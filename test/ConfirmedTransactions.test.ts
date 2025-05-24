import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Confirmed Transacrions", function () {
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

  describe("Transaction Confirmation", function () {
    it("GetConfirmedTransaction should not return transaction that occured after the timeout", async function () {
      const {
        bridge,
        ownerGovernorContract,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBRC_confirmedTransactions,
        validatorAddressChainData,
        hre,
        claims,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(ownerGovernorContract).registerChain(chain2, 1000, validatorAddressChainData);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          Number(firstTimestampBlockNumber)
        );

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });

      // wait for next timeout
      for (let i = 0; i < 6; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_confirmedTransactions);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC_confirmedTransactions);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC_confirmedTransactions);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC_confirmedTransactions);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC_confirmedTransactions.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      expect(confirmedTxs.length).to.equal(1);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(
        await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      );
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
    });

    it("GetConfirmedTransactions should not return more transaction than MAX_NUMBER_OF_TRANSACTIONS", async function () {
      const {
        bridge,
        ownerGovernorContract,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorAddressChainData,
        claims,
        hre,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(ownerGovernorContract).registerChain(chain2, 1000, validatorAddressChainData);
      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Bridge in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          Number(firstTimestampBlockNumber + 100)
        );

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });

      const validatorClaimsBRC2 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737600000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC3);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC2.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainId).to.equal(validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });

    it("GetConfirmedTransactions should return transactions with appropriate Observed Transaction Hashes", async function () {
      const {
        bridge,
        ownerGovernorContract,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorAddressChainData,
        claims,
        hre,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 1000, validatorAddressChainData);
      await bridge.connect(ownerGovernorContract).registerChain(chain2, 1000, validatorAddressChainData);
      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeContratAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeContratAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          Number(firstTimestampBlockNumber + 100)
        );

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeContratAddress],
      });

      const validatorClaimsBRC2 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737700000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737800000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC3);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC3.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainId).to.equal(validatorClaimsBRC3.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });
  });
});
