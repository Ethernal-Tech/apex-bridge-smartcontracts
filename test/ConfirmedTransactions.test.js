import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Confirmed Transactions", function () {
  describe("Transaction Confirmation", function () {
    it("GetConfirmedTransaction should not return transaction that occured after the timeout", async function () {
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const firstTimestampBlockNumber = await connection.ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      for (let i = 0; i < 10; i++) {
        await connection.ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);

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
      const firstTimestampBlockNumber = await connection.ethers.provider.getBlockNumber();

      // Impersonate as Bridge in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();
      const claimsProcessorAddress = await claimsProcessor.getAddress();

      var signer = await impersonateAsContractAndMintFunds(claimsProcessorAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          Number(firstTimestampBlockNumber + 100)
        );

      const tempBRC = structuredClone(validatorClaimsBRC);
      tempBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 1n;
      tempBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination = 1n;
      tempBRC.bridgingRequestClaims[0].receivers.push({
        amount: 200,
        amountWrapped: 200,
        destinationAddress: "0x123...",
        tokenId: 1,
      });

      const validatorClaimsBRC2 = {
        ...tempBRC,
        bridgingRequestClaims: [
          {
            ...tempBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...tempBRC,
        bridgingRequestClaims: [
          {
            ...tempBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737600000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      await bridge.connect(validators[0]).submitClaims(tempBRC);
      await bridge.connect(validators[1]).submitClaims(tempBRC);
      await bridge.connect(validators[2]).submitClaims(tempBRC);
      await bridge.connect(validators[3]).submitClaims(tempBRC);

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
      const expectedReceiversWrappedAmount = tempBRC.bridgingRequestClaims[0].receivers[1].amountWrapped;

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
      expect(confirmedTxs[0].receivers[0].tokenId).to.equal(0);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC2.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainId).to.equal(validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[1].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[1].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].receivers[0].tokenId).to.equal(0);
      expect(confirmedTxs[1].receivers[1].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[1].receivers[1].amountWrapped).to.equal(expectedReceiversWrappedAmount);
      expect(confirmedTxs[1].receivers[1].tokenId).to.equal(1);
    });

    it("GetConfirmedTransactions should return transactions with appropriate Observed Transaction Hashes", async function () {
      const firstTimestampBlockNumber = await connection.ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const claimsProcessorAddress = await claimsProcessor.getAddress();

      var signer = await impersonateAsContractAndMintFunds(claimsProcessorAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
          Number(firstTimestampBlockNumber + 100)
        );

      const tempBRC = structuredClone(validatorClaimsBRC);
      tempBRC.bridgingRequestClaims[0].nativeCurrencyAmountDestination = 1n;
      tempBRC.bridgingRequestClaims[0].wrappedTokenAmountDestination = 1n;

      const validatorClaimsBRC2 = {
        ...tempBRC,
        bridgingRequestClaims: [
          {
            ...tempBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737700000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...tempBRC,
        bridgingRequestClaims: [
          {
            ...tempBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737800000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      await bridge.connect(validators[0]).submitClaims(tempBRC);
      await bridge.connect(validators[1]).submitClaims(tempBRC);
      await bridge.connect(validators[2]).submitClaims(tempBRC);
      await bridge.connect(validators[3]).submitClaims(tempBRC);

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

    it("GetConfirmedTransactions should return confirmed transaction after RefundRequestClaim", async function () {
      // Impersonate as Bridge in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      const expectedTokenAmounts = [
        { tokenId: 1, amountCurrency: 10, amountToken: 100 },
        { tokenId: 2, amountCurrency: 10, amountToken: 200 },
      ];

      // Clone and modify refundRequestClaims
      const tempRRC = structuredClone(validatorClaimsRRC);
      tempRRC.refundRequestClaims[0].tokenAmounts = expectedTokenAmounts.map((t) => ({
        tokenId: t.tokenId,
        amountTokens: t.amountToken,
        amountCurrency: t.amountCurrency,
      }));

      // Submit BRC claims
      for (const validator of validators) {
        await bridge.connect(validator).submitClaims(validatorClaimsBRC);
      }

      // Submit RRC claims
      for (const validator of validators) {
        await bridge.connect(validator).submitClaims(tempRRC);
      }

      const claim = tempRRC.refundRequestClaims[0];
      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(claim.originChainId);

      const expectedReceiversAddress = claim.originSenderAddress;
      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);

      // Basic transaction checks
      const tx = confirmedTxs[1];
      expect(confirmedTxs.length).to.equal(2);
      expect(tx.nonce).to.equal(2);
      expect(tx.observedTransactionHash).to.equal(claim.originTransactionHash);
      expect(tx.sourceChainId).to.equal(claim.originChainId);
      expect(tx.blockHeight).to.be.lessThan(blockNum);

      // Receivers checks
      expect(tx.receivers.length).to.equal(2);

      tx.receivers.forEach((receiver, idx) => {
        expect(receiver.destinationAddress).to.equal(expectedReceiversAddress);

        const expected = expectedTokenAmounts[idx];
        expect(receiver.amount).to.equal(expected.amountCurrency);
        expect(receiver.amountWrapped).to.equal(expected.amountToken);
        expect(receiver.tokenId).to.equal(expected.tokenId);
      });
    });
  });

  async function impersonateAsContractAndMintFunds(contractAddress) {
    const address = contractAddress.toLowerCase();

    // impersonate as a contract on specified address
    await provider.send("hardhat_impersonateAccount", [address]);

    const signer = await connection.ethers.getSigner(address);

    // minting 100000000000000000000 tokens to signer
    await provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]);

    return signer;
  }

  let bridge;
  let claims;
  let claimsProcessor;
  let owner;
  let chain1;
  let chain2;
  let validatorClaimsBRC;
  let validatorClaimsRRC;
  let validatorAddressChainData;
  let validators;
  let connection;
  let provider;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    claims = fixture.claims;
    claimsProcessor = fixture.claimsProcessor;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorClaimsBRC = fixture.validatorClaimsBRC;
    validatorClaimsRRC = fixture.validatorClaimsRRC;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
    connection = fixture.connection;
    provider = fixture.provider;

    // Register chains
    await bridge.connect(owner).registerChain(chain1, 100, 100, validatorAddressChainData);
    await bridge.connect(owner).registerChain(chain2, 100, 100, validatorAddressChainData);
  });
});
