import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "./fixtures";

describe("Chain Registration", function () {
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

  describe("Registering new chain with Owner", function () {
    it("Should revert new chain if not set by owner", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(validators[0]).registerChain(chain1, 100, validatorsCardanoData)
      ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
    });

    it("Should add new chain if requested by owner", async function () {
      const { bridge, claims, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
      const { bridge, claims, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(0);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by owner", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData))
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });
  });

  describe("Registering new chain with Governance", function () {
    it("Should revert proposal if chain is already registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;

      await expect(
        bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data)
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should revert proposal if not sent by validator", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridge, claimsHelper, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      await expect(
        bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should emit new chain proposal", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data))
        .to.emit(bridge, "newChainProposal")
        .withArgs(1, validators[0].address);
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(BigInt(0));

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);

      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);

      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      await expect(bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data))
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });

    it("Should list all registered chains", async function () {
      const { bridge, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);
      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data);

      await bridge.connect(validators[0]).registerChainGovernance(chain2, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain2, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain2, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain2, 100, validatorsCardanoData[3].data);
      await bridge.connect(validators[4]).registerChainGovernance(chain2, 100, validatorsCardanoData[4].data);

      const chains = await bridge.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal(1);
      expect(chains[1].id).to.equal(2);

      const valids1 = await bridge.getValidatorsCardanoData(1);
      const valids2 = await bridge.getValidatorsCardanoData(2);
      expect(valids1.length).to.equal(5);
      expect(valids2.length).to.equal(5);

      for (let i = 0; i < validatorsCardanoData.length; i++) {
        expect(valids1[i].verifyingKey).to.equal(validatorsCardanoData[i].data.verifyingKey);
        expect(valids1[i].verifyingKeyFee).to.equal(validatorsCardanoData[i].data.verifyingKeyFee);

        expect(valids2[i].verifyingKey).to.equal(validatorsCardanoData[i].data.verifyingKey);
        expect(valids2[i].verifyingKeyFee).to.equal(validatorsCardanoData[i].data.verifyingKeyFee);
      }
    });

    it("Should not update Validators Cardano Data until all validators submit their data", async function () {
      const { bridge, validatorsc, validatorsCardanoData, validators, hre, validator6 } = await loadFixture(
        deployBridgeFixture
      );

      const bridgeAddress = await bridge.getAddress();

      const signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[0].addr, validatorsCardanoData[0].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[1].addr, validatorsCardanoData[1].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[2].addr, validatorsCardanoData[2].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[3].addr, validatorsCardanoData[3].data);

      const data = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);

      expect(data.length).to.equal(0);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[4].addr, validatorsCardanoData[4].data);

      const data2 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
      expect(data2.length).to.equal(await validatorsc.validatorsCount());

      await validatorsc.connect(signer).addValidatorCardanoData(1, validator6, validatorsCardanoData[4].data);

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
      expect(data3.length).to.equal(await validatorsc.validatorsCount());

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });
    });

    it("Should not update Validators Cardano Data until length of the list with the new data doesn't match the number of validators", async function () {
      const { bridge, validatorsc, validatorsCardanoData, validators, hre, validator6 } = await loadFixture(
        deployBridgeFixture
      );

      const bridgeAddress = await bridge.getAddress();

      const signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      validatorsCardanoData.push({
        addr: validator6.address,
        data: {
          verifyingKey: "0x746573760000000000000000000000000000000000000000000000000000000" + 5,
          verifyingKeyFee: "0x74657376000000000000000000000000000000000000000000000000000000" + 5 + "2",
        },
      });

      await expect(
        validatorsc.connect(signer).setValidatorsCardanoData(1, validatorsCardanoData)
      ).to.revertedWithCustomError(validatorsc, "InvalidData");

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
      expect(validatorsCardanoData.length).to.be.greaterThan(validators.length);
      expect(data3.length).to.equal(0);

      validatorsCardanoData.pop();

      expect(validatorsCardanoData.length).to.equal(validators.length);

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });
    });
  });
});
