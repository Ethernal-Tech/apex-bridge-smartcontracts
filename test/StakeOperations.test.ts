import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture, TransactionSubType, TransactionType } from "./fixtures";

describe("Stake Registration", function () {
    const stakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";

    it("Should revert if registration is not sent by owner", async function () {
        const { admin, chain1, validators, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(validators[0]).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { admin, owner, chain1, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
    });

    it("Should revert if pool id is invalid", async () => {
        const { bridge, admin, owner, chain1, bridgeAddrIndex, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, "none", TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "InvalidData");
    });

    it("Should revert if index of bridging address is invalid", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
        const invalidBridgeAddr = 1;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, invalidBridgeAddr, stakePoolId, TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "InvalidBridgeAddrIndex");
    });

    it("Should revert if the bridging address has already been registered.", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "AddrAlreadyRegistered");
    });

    it("Should increase last confirmed tx nonce when delegation is added", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);
    });

    it("Should set isAddrDelegatedToStake to true when registration is successful", async function () {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex, bridgingAddresses } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);
        expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.true;
    });

    it("Should correctly store a new confirmed transaction of type stake registration", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);
        //await registerChainAndDelegate(bridge, owner, validatorAddressChainData, bridgeAddrIndex, 1);
        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

        const nonce = await claims.lastConfirmedTxNonce(chain1.id);

        const tx = await claims.confirmedTransactions(chain1.id, nonce);
        expect(tx.destinationChainId).to.equal(chain1.id);
        expect(tx.stakePoolId).to.equal(stakePoolId);
        expect(tx.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx.nonce).to.equal(nonce);
        expect(tx.transactionType).to.equal(TransactionType.STAKE);
        expect(tx.transactionSubType).to.equal(TransactionSubType.STAKE_REGISTRATION);
        expect(tx.retryCounter).to.equal(0);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, admin, claims, owner, validators, signedBatchStakeDelOrRedistr, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send("evm_mine");
        }

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
        }

        expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
    });
});

describe("Stake Redelegation", function () {
    const stakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";

    it("Should revert if redelegation is not sent by owner", async function () {
        const { admin, chain1, validators, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(validators[0]).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { admin, owner, chain1, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION))
            .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
    });

    it("Should revert if pool id is invalid", async () => {
        const { bridge, admin, owner, chain1, bridgeAddrIndex, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, "none", TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "InvalidData");
    });

    it("Should revert if index of bridging address is invalid", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
        const invalidBridgeAddr = 1;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, invalidBridgeAddr, stakePoolId, TransactionSubType.STAKE_REGISTRATION))
            .to.be.revertedWithCustomError(admin, "InvalidBridgeAddrIndex");
    });

    it("Should revert if the bridging address isn't registered.", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION))
            .to.be.revertedWithCustomError(admin, "AddrNotRegistered");
    });

    it("Should increase last confirmed tx nonce when delegation is added", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });

    it("Should set isAddrDelegatedToStake to true when redelegation is successful", async function () {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex, bridgingAddresses } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);
        expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.true;

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION);
        expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.true;
    });

    it("Should correctly store a new confirmed transaction of type stake redelegation", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);
        //await registerChainAndDelegate(bridge, owner, validatorAddressChainData, bridgeAddrIndex, 1);
        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION);

        const nonce = await claims.lastConfirmedTxNonce(chain1.id);

        const tx = await claims.confirmedTransactions(chain1.id, nonce);
        expect(tx.destinationChainId).to.equal(chain1.id);
        expect(tx.stakePoolId).to.equal(stakePoolId);
        expect(tx.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx.nonce).to.equal(nonce);
        expect(tx.transactionType).to.equal(TransactionType.STAKE);
        expect(tx.transactionSubType).to.equal(TransactionSubType.STAKE_DELEGATION);
        expect(tx.retryCounter).to.equal(0);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, admin, claims, owner, validators, signedBatchStakeDelOrRedistr, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_REGISTRATION);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, stakePoolId, TransactionSubType.STAKE_DELEGATION);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send("evm_mine");
        }

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
        }

        expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
    });
});

describe("Stake Deregistration", function () {
    const correctStakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";
    const invalidStakePoolId = "";

    it("Should revert if deregistration is not sent by owner", async function () {
        const { admin, chain1, validators, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(validators[0]).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { admin, owner, chain1, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION))
            .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
    });

    it("Should revert if index of bridging address is invalid", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
        const invalidBridgeAddr = 1;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, invalidBridgeAddr, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION))
            .to.be.revertedWithCustomError(admin, "InvalidBridgeAddrIndex");
    });

    it("Should revert if the bridging address wasn't registered.", async () => {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        await expect(admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION))
            .to.be.revertedWithCustomError(admin, "AddrNotRegistered");
    });

    it("Should increase last confirmed tx nonce when delegation is added", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, correctStakePoolId, TransactionSubType.STAKE_REGISTRATION);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(2);
    });

    it("Should set isAddrDelegatedToStake to false when deregistration is successful", async function () {
        const { bridge, admin, owner, chain1, validatorAddressChainData, bridgeAddrIndex, bridgingAddresses } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, correctStakePoolId, TransactionSubType.STAKE_REGISTRATION);
        expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.true;

        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION);
        expect(await bridgingAddresses.isAddrDelegatedToStake(chain1.id, bridgeAddrIndex)).to.be.false;
    });

    it("Should correctly store a new confirmed transaction of type stake deregistration", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);
        //await registerChainAndDelegate(bridge, owner, validatorAddressChainData, bridgeAddrIndex, 1);
        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, correctStakePoolId, TransactionSubType.STAKE_REGISTRATION);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION);

        const nonce = await claims.lastConfirmedTxNonce(chain1.id);

        const tx = await claims.confirmedTransactions(chain1.id, nonce);
        expect(tx.destinationChainId).to.equal(chain1.id);
        expect(tx.stakePoolId).to.equal(invalidStakePoolId);
        expect(tx.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx.nonce).to.equal(nonce);
        expect(tx.transactionType).to.equal(TransactionType.STAKE);
        expect(tx.transactionSubType).to.equal(TransactionSubType.STAKE_DEREGISTRATION);
        expect(tx.retryCounter).to.equal(0);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, admin, claims, owner, validators, signedBatchStakeDelOrRedistr, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, correctStakePoolId, TransactionSubType.STAKE_REGISTRATION);
        await admin.connect(owner).stakeAddressOperation(chain1.id, bridgeAddrIndex, invalidStakePoolId, TransactionSubType.STAKE_DEREGISTRATION);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
            await ethers.provider.send("evm_mine");
        }

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
        }

        expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
    });
});