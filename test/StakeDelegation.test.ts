import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture, TransactionType } from "./fixtures";

describe("Stake Delegation", function () {
    const stakePoolId = "pool1y0uxkqyplyx6ld25e976t0s35va3ysqcscatwvy2sd2cwcareq7";

    it("Should revert if delegation is not sent by owner", async function () {
        const { bridge, chain1, validators, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(bridge.connect(validators[0]).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { bridge, owner, chain1, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await expect(bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId))
            .to.be.revertedWithCustomError(bridge, "InvalidBridgeAddrIndex");
    });

    it("Should revert if pool id is invalid", async () => {
        const { bridge, owner, chain1, bridgeAddrIndex, validatorAddressChainData } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, "none"))
            .to.be.revertedWithCustomError(bridge, "InvalidData");
    });

    it("Should revert if index of bridging address is invalid", async () => {
        const { bridge, owner, chain1, validatorAddressChainData } = await loadFixture(deployBridgeFixture);
        const invalidBridgeAddr = 1;

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await expect(bridge.connect(owner).delegateAddrToStakePool(chain1.id, invalidBridgeAddr, stakePoolId))
            .to.be.revertedWithCustomError(bridge, "InvalidBridgeAddrIndex");
    });

    it("Should revert if the bridging address has already been delegated to a stake pool.", async () => {
        const { bridge, owner, chain1, validatorAddressChainData, bridgeAddrIndex } = await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId);

        await expect(bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId))
            .to.be.revertedWithCustomError(bridge, "AddrAlreadyDelegatedToStake");
    });

    it("Should increase last confirmed tx nonce when delegation is added", async function () {
        const { bridge, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(0);

        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId);

        expect(await claims.lastConfirmedTxNonce(chain1.id)).to.equal(1);
    });

    it("Should correctly store a new confirmed transaction of type stake delegation", async function () {
        const { bridge, claims, owner, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);
        //await registerChainAndDelegate(bridge, owner, validatorAddressChainData, bridgeAddrIndex, 1);
        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId);

        const nonce = await claims.lastConfirmedTxNonce(chain1.id);

        const tx = await claims.confirmedTransactions(chain1.id, nonce);
        expect(tx.destinationChainId).to.equal(chain1.id);
        expect(tx.stakePoolId).to.equal(stakePoolId);
        expect(tx.bridgeAddrIndex).to.equal(bridgeAddrIndex);
        expect(tx.nonce).to.equal(nonce);
        expect(tx.transactionType).to.equal(TransactionType.STAKE_DELEGATION);
        expect(tx.retryCounter).to.equal(0);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, claims, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData, bridgeAddrIndex } =
            await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);
        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, bridgeAddrIndex, stakePoolId);

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