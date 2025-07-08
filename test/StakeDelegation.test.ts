import { loadFixture, setCode, reset } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Stake Delegation", function () {
    
    const stakePoolIds = ["stakePoolId", "stakePoolId1", "stakePoolId2"];

    async function registerChainAndDelegate(bridge, owner, chain, validatorData, count = 2) {
        await bridge.connect(owner).registerChain(chain, 10000, 10000, validatorData);
        for (let i = 0; i < count; i++) {
        await bridge.connect(owner).delegateAddrToStakePool(chain.id, stakePoolIds[i]);
        }
    }

    it("Should revert if delegation is not sent by owner", async function () {
      const { bridge, chain1, validators } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).delegateAddrToStakePool(chain1.id, stakePoolIds[0]))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if chain is not registered", async () => {
        const { bridge, owner, chain1 } = await loadFixture(deployBridgeFixture);

        await expect(bridge.connect(owner).delegateAddrToStakePool(chain1.id, stakePoolIds[0]))
        .to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");
    });

    it("Should increase stake delegation nonce when delegation is added", async function () {
        const { bridge, claimsHelper, owner, chain1, chain2, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

        await bridge.connect(owner).registerChain(chain1, 10000, 10000, validatorAddressChainData);

        expect(await claimsHelper.lastStakeDelegationTxNonce(chain1.id)).to.equal(0);

        await bridge.connect(owner).delegateAddrToStakePool(chain1.id, stakePoolIds[0]);

        expect(await claimsHelper.lastStakeDelegationTxNonce(chain1.id)).to.equal(1);
    });

    it("Should store new stakeDelegationTx correctly", async function () {
        const { bridge, claimsHelper, owner, chain1, validatorAddressChainData } =
        await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 1);
        const nonce = await claimsHelper.lastStakeDelegationTxNonce(chain1.id);

        const tx = await claimsHelper.stakeDelegationTransactions(chain1.id, nonce);
        expect(tx.chainId).to.equal(chain1.id);
        expect(tx.stakePoolId).to.equal(stakePoolIds[0]);
        expect(tx.nonce).to.equal(nonce);
    });

    it("Should not create batch if chain is not registered", async function () {
        const { claims, chain1 } = await loadFixture(deployBridgeFixture);
        expect(await claims.shouldCreateStakeDelBatch(chain1.id)).to.be.false;
    });

    it("Should create batch after adding stake delegation txs", async function () {
        const { bridge, claims, owner, chain1, validatorAddressChainData } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 2);        
        expect(await claims.shouldCreateStakeDelBatch(chain1.id)).to.be.true;
    });

    it("Should return correct stake delegation txs for new batch", async function () {
        const { bridge, owner, chain1, validatorAddressChainData } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 3);
        const stakeDelTxs = await bridge.getStakeDelegationTransactions(chain1.id);

        const maxNumberOfTransactions = 2;
        expect(stakeDelTxs.length).to.equal(maxNumberOfTransactions);

        expect(stakeDelTxs[0].chainId).to.equal(chain1.id);
        expect(stakeDelTxs[0].stakePoolId).to.equal(stakePoolIds[0]);
        expect(stakeDelTxs[0].nonce).to.equal(1);

        expect(stakeDelTxs[1].chainId).to.equal(chain1.id);
        expect(stakeDelTxs[1].stakePoolId).to.equal(stakePoolIds[1]);
        expect(stakeDelTxs[1].nonce).to.equal(2);
    });

    it("Should not create batch when execution is in progress", async function () {
        const { bridge, claims, owner, validators, signedBatchStakeDel, chain1, validatorAddressChainData } =
            await loadFixture(deployBridgeFixture);

        await registerChainAndDelegate(bridge, owner, chain1, validatorAddressChainData, 2);

        for (const v of validators.slice(0, 4)) {
            await bridge.connect(v).submitSignedBatch(signedBatchStakeDel);
        }

        expect(await claims.shouldCreateStakeDelBatch(chain1.id)).to.be.false;
    });
});