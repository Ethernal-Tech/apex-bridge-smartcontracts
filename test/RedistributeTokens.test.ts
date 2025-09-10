import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture, TransactionSubType, TransactionType } from "./fixtures";

describe("Redistribute Tokens", function () {
    it("Should revert if token redistribution is not sent by owner", async function () {
        const { admin, chain1, validators } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(validators[0]).redistributeBridgingAddrsTokens(chain1.id))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { admin, owner, chain1 } = await loadFixture(deployBridgeFixture);

        await expect(admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id))
            .to.be.revertedWithCustomError(admin, "ChainIsNotRegistered");
    });

    it("Should revert on Claims if redistribution is not called by Bridge", async function () {
        const { claims, chain1, validators } = await loadFixture(deployBridgeFixture);

        await expect(claims.connect(validators[0]).createRedistributeTokensTx(chain1.id))
            .to.be.revertedWithCustomError(claims, "NotAdminContract");
    });

    it("Should increase last confirmed tx nonce when redistribution transaction is added", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

        await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);

        const confirmedTxs = await claims
            .connect(owner)
            .confirmedTransactions(chain1.id, 1);

        const blockNum = await claims.nextTimeoutBlock(chain1.id);
        expect(confirmedTxs.nonce).to.equal(1);
        expect(confirmedTxs.transactionType).to.equal(TransactionType.REDISTRIBUTION);
        expect(confirmedTxs.blockHeight).to.be.lessThan(blockNum);
        expect(confirmedTxs.retryCounter).to.equal(0);
        expect(confirmedTxs.destinationChainId).to.equal(chain1.id);
    });

    it("Should update next timeout when redistribution transaction is added", async function () {
        const { bridge, admin, claims, owner, chain1, validatorAddressChainData } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

        await expect(bridge.connect(owner).getConfirmedTransactions(chain1.id))
            .to.be.revertedWithCustomError(claims, "CanNotCreateBatchYet");

        // wait for next timeout
        for (let i = 0; i < 4; i++) {
            await ethers.provider.send("evm_mine");
        }

        const confirmedTxs = await bridge.connect(owner).getConfirmedTransactions(chain1.id)

        const blockNum = await claims.nextTimeoutBlock(chain1.id);
        expect(confirmedTxs.length).to.equal(1);
        expect(confirmedTxs[0].nonce).to.equal(1);
        expect(confirmedTxs[0].transactionType).to.equal(TransactionType.REDISTRIBUTION);
        expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
        expect(confirmedTxs[0].retryCounter).to.equal(0);
        expect(confirmedTxs[0].destinationChainId).to.equal(chain1.id);
    });

    it("Should not create batch when redistribution is in progress", async function () {
        const { bridge, admin, claims, owner, validators, signedBatchStakeDelOrRedistr, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await admin.connect(owner).redistributeBridgingAddrsTokens(chain1.id);

        // wait for next timeout
        for (let i = 0; i < 5; i++) {
            await ethers.provider.send("evm_mine");
        }
        expect(await claims.shouldCreateBatch(chain1.id)).to.be.true;

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDelOrRedistr);
        }

        expect(await claims.shouldCreateBatch(chain1.id)).to.be.false;
    });
});