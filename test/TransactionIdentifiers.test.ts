import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {
  deployBridgeFixture,
  hashBridgeRequestClaim,
  hashRefundRequestClaim,
  hashHotWalletIncrementClaim,
} from "./fixtures";

// Solana transaction identifiers are 64 bytes. Only the final byte differs,
// so neither the legacy bytes32 field nor a truncated prefix can distinguish them.
const transactionIdA = "0x" + "11".repeat(63) + "01";
const transactionIdB = "0x" + "11".repeat(63) + "02";

async function registeredChainsFixture() {
  const fixture = await deployBridgeFixture();
  for (const chain of [fixture.chain2, fixture.chain3]) {
    await fixture.bridge.registerChain(chain, 1000, 1000, fixture.validatorAddressChainData);
  }
  return fixture;
}

describe("Transaction Identifiers", function () {
  it("Should keep Bridging Request Claim votes separate and preserve full 64-byte identifiers", async function () {
    const f = await loadFixture(registeredChainsFixture);
    const first = structuredClone(f.validatorClaimsBRC);
    first.bridgingRequestClaims[0].sourceChainId = f.chain3.id;
    first.bridgingRequestClaims[0].observedTransactionHash = transactionIdA;
    const second = structuredClone(first);
    second.bridgingRequestClaims[0].observedTransactionHash = transactionIdB;
    const hashA = hashBridgeRequestClaim(first.bridgingRequestClaims[0]);
    const hashB = hashBridgeRequestClaim(second.bridgingRequestClaims[0]);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(first);
    }
    await f.bridge.connect(f.validators[3]).submitClaims(second);
    expect(await f.claimsHelper.numberOfVotes(hashA)).to.equal(3);
    expect(await f.claimsHelper.numberOfVotes(hashB)).to.equal(1);
    expect(await f.claims.lastConfirmedTxNonce(f.chain2.id)).to.equal(0);
    expect(await f.chainTokens.chainTokenQuantity(f.chain2.id)).to.equal(1000);

    await f.bridge.connect(f.validators[3]).submitClaims(first);
    expect(await f.claims.lastConfirmedTxNonce(f.chain2.id)).to.equal(1);
    expect((await f.claims.getConfirmedTransaction(f.chain2.id, 1)).observedTransactionHash).to.equal(transactionIdA);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(second);
    }
    expect(await f.claims.lastConfirmedTxNonce(f.chain2.id)).to.equal(2);
    expect((await f.claims.getConfirmedTransaction(f.chain2.id, 2)).observedTransactionHash).to.equal(transactionIdB);

    // A validator that has not voted on either confirmed claim cannot execute it again.
    await f.bridge.connect(f.validators[4]).submitClaims(first);
    await f.bridge.connect(f.validators[4]).submitClaims(second);
    expect(await f.claims.lastConfirmedTxNonce(f.chain2.id)).to.equal(2);
    expect(await f.chainTokens.chainTokenQuantity(f.chain2.id)).to.equal(800);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain2.id)).to.equal(800);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1200);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(1200);
  });

  it("Should keep Refund Request Claim votes separate and preserve full 64-byte origin identifiers", async function () {
    const f = await loadFixture(registeredChainsFixture);
    const first = structuredClone(f.validatorClaimsRRC);
    first.refundRequestClaims[0].originChainId = f.chain3.id;
    first.refundRequestClaims[0].destinationChainId = f.chain2.id;
    first.refundRequestClaims[0].originTransactionHash = transactionIdA;
    first.refundRequestClaims[0].shouldDecrementHotWallet = true;
    const second = structuredClone(first);
    second.refundRequestClaims[0].originTransactionHash = transactionIdB;
    const hashA = hashRefundRequestClaim(first.refundRequestClaims[0]);
    const hashB = hashRefundRequestClaim(second.refundRequestClaims[0]);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(first);
    }
    await f.bridge.connect(f.validators[3]).submitClaims(second);
    expect(await f.claimsHelper.numberOfVotes(hashA)).to.equal(3);
    expect(await f.claimsHelper.numberOfVotes(hashB)).to.equal(1);
    expect(await f.claims.lastConfirmedTxNonce(f.chain3.id)).to.equal(0);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1000);

    await f.bridge.connect(f.validators[3]).submitClaims(first);
    expect(await f.claims.lastConfirmedTxNonce(f.chain3.id)).to.equal(1);
    expect((await f.claims.getConfirmedTransaction(f.chain3.id, 1)).observedTransactionHash).to.equal(transactionIdA);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(second);
    }
    expect(await f.claims.lastConfirmedTxNonce(f.chain3.id)).to.equal(2);
    expect((await f.claims.getConfirmedTransaction(f.chain3.id, 2)).observedTransactionHash).to.equal(transactionIdB);

    await f.bridge.connect(f.validators[4]).submitClaims(first);
    await f.bridge.connect(f.validators[4]).submitClaims(second);
    expect(await f.claims.lastConfirmedTxNonce(f.chain3.id)).to.equal(2);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(800);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(800);
  });

  it("Should require independent quorums for 64-byte Hot Wallet Increment Claims", async function () {
    const f = await loadFixture(registeredChainsFixture);
    const first = structuredClone(f.validatorClaimsHWIC);
    first.hotWalletIncrementClaims[0].chainId = f.chain3.id;
    first.hotWalletIncrementClaims[0].txHash = transactionIdA;
    const second = structuredClone(first);
    second.hotWalletIncrementClaims[0].txHash = transactionIdB;
    const hashA = hashHotWalletIncrementClaim(first.hotWalletIncrementClaims[0]);
    const hashB = hashHotWalletIncrementClaim(second.hotWalletIncrementClaims[0]);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(first);
    }
    await f.bridge.connect(f.validators[3]).submitClaims(second);
    expect(await f.claimsHelper.numberOfVotes(hashA)).to.equal(3);
    expect(await f.claimsHelper.numberOfVotes(hashB)).to.equal(1);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1000);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(1000);

    await f.bridge.connect(f.validators[3]).submitClaims(first);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1100);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(1100);

    for (const index of [0, 1, 2]) {
      await f.bridge.connect(f.validators[index]).submitClaims(second);
    }
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1200);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(1200);

    await f.bridge.connect(f.validators[4]).submitClaims(first);
    await f.bridge.connect(f.validators[4]).submitClaims(second);
    expect(await f.chainTokens.chainTokenQuantity(f.chain3.id)).to.equal(1200);
    expect(await f.chainTokens.chainWrappedTokenQuantity(f.chain3.id)).to.equal(1200);
  });
});
