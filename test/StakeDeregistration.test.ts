import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture, TransactionType } from "./fixtures";

describe("Stake Deregistration", function () {
    
    it("Should revert if deregistration is not sent by owner", async function () {
      const { bridge, chain1, validators, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).deregisterStakeAddress(chain1.id, bridgeAddrIndex))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { bridge, owner, chain1, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex))
        .to.be.revertedWithCustomError(bridge, "AddrNotDelegatedToStake");
    });

    it("Should revert if index of bridging address is invalid", async () => {
        const { bridge, owner, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
        const invalidBridgeAddr = 1;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(bridge.connect(owner).deregisterStakeAddress(chain1.id, invalidBridgeAddr))
            .to.be.revertedWithCustomError(bridge, "InvalidBridgeAddrIndex");
    });

    it("Should revert if the bridging address has not been delegated to a stake pool.", async () => {
        const { bridge, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        await expect(bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex))
            .to.be.revertedWithCustomError(bridge, "AddrNotDelegatedToStake");
    });

    it("Should pass if the bridging address has been delegated to a stake pool and deregistration is called.", async () => {
        const {bridge, claims, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);
        
        // First delegate to stake pool
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7", true);
        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);
        expect(await admin.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.true;

        // Then deregister
        await bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex);
        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
        expect(await admin.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.false;

        const tx1 = await claims.confirmedTransactions(chain1.id, 1);
        expect(tx1.destinationChainId).to.equal(chain1.id);
        expect(tx1.stakePoolId).to.equal("pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7");
        expect(tx1.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx1.nonce).to.equal(1);
        expect(tx1.transactionType).to.equal(TransactionType.STAKE_REGISTRATION_AND_DELEGATION);
        expect(tx1.retryCounter).to.equal(0);

        const tx2 = await claims.confirmedTransactions(chain1.id, 2);
        expect(tx2.destinationChainId).to.equal(chain1.id);
        expect(tx2.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx2.nonce).to.equal(2);
        expect(tx2.transactionType).to.equal(TransactionType.STAKE_DEREGISTRATION);
        expect(tx2.retryCounter).to.equal(0);
    });

    it("Should increase last confirmed tx nonce when deregistration is added", async function () {
        const { bridge, claims, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
        await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        // First delegate to stake pool
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7", true);
        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

        await bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });

    it("Should correctly store a new confirmed transaction of type stake deregistration", async function () {
        const { bridge, claims, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
        await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        
        // First delegate to stake pool
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7", true);
        await bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex);

        const nonce = await claims.lastConfirmedTxNonce(chain1.id);

        const tx = await claims.confirmedTransactions(chain1.id, nonce);
        expect(tx.destinationChainId).to.equal(chain1.id);
        expect(tx.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx.nonce).to.equal(nonce);
        expect(tx.transactionType).to.equal(TransactionType.STAKE_DEREGISTRATION);
        expect(tx.retryCounter).to.equal(0);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, claims, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        
        // First delegate to stake pool
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7", true);
        await bridge.connect(owner).deregisterStakeAddress(chain1.id, bridgeAddrIndex);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send("evm_mine");
        }

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDel);
        }

        expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
    });
}); 