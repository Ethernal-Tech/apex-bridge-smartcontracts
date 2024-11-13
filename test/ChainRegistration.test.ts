import { ConfirmedBatchStruct } from "./../typechain-types/contracts/interfaces/IBridgeContract";
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
    it("setChainAdditionalData should be allowed for owner", async function () {
      const { bridge, chain1, owner, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);
      const [multisigAddr, feeAddr] = ["0xff0033", "0x0007788aa"];

      await expect(
        bridge.connect(owner).setChainAdditionalData(chain1.id, multisigAddr, feeAddr)
      ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");

      await expect(
        bridge.connect(validators[0]).setChainAdditionalData(chain1.id, multisigAddr, feeAddr)
      ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);
      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);
      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[4].data);

      await bridge.connect(owner).setChainAdditionalData(chain1.id, multisigAddr, feeAddr);

      const chains = await bridge.getAllRegisteredChains();
      expect(chains.length).to.equal(1);
      expect(chains[0].id).to.equal(1);
      expect(chains[0].addressMultisig).to.equal(multisigAddr);
      expect(chains[0].addressFeePayer).to.equal(feeAddr);
    });
  });

  describe("Registering new chain with Governance", function () {
    it("Should revert proposal if chain is already registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[4].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[4].data)
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should revert proposal if not sent by validator", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridge, claimsHelper, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should emit new chain proposal", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data)
      )
        .to.emit(bridge, "newChainProposal")
        .withArgs(1, validators[0].address);
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);
      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);
      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(BigInt(0));

      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);

      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);

      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);

      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[4].data)
      )
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });

    it("Should list all registered chains", async function () {
      const { bridge, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[2].data);
      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[3].data);
      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain1.id, chain1.chainType, 100, validatorsCardanoData[4].data);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(chain2.id, chain2.chainType, 100, validatorsCardanoData[0].data);
      await bridge
        .connect(validators[1])
        .registerChainGovernance(chain2.id, chain2.chainType, 100, validatorsCardanoData[1].data);
      await bridge
        .connect(validators[2])
        .registerChainGovernance(chain2.id, chain2.chainType, 100, validatorsCardanoData[2].data);
      await bridge
        .connect(validators[3])
        .registerChainGovernance(chain2.id, chain2.chainType, 100, validatorsCardanoData[3].data);
      await bridge
        .connect(validators[4])
        .registerChainGovernance(chain2.id, chain2.chainType, 100, validatorsCardanoData[4].data);

      const chains = await bridge.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal(1);
      expect(chains[1].id).to.equal(2);

      const valids1 = await bridge.getValidatorsChainData(1);
      const valids2 = await bridge.getValidatorsChainData(2);
      expect(valids1.length).to.equal(5);
      expect(valids2.length).to.equal(5);

      for (let i = 0; i < validatorsCardanoData.length; i++) {
        expect(valids1[i].key[0]).to.equal(validatorsCardanoData[i].data.key[0]);
        expect(valids1[i].key[1]).to.equal(validatorsCardanoData[i].data.key[1]);
        expect(valids1[i].key[2]).to.equal(validatorsCardanoData[i].data.key[2]);
        expect(valids1[i].key[3]).to.equal(validatorsCardanoData[i].data.key[3]);

        expect(valids2[i].key[0]).to.equal(validatorsCardanoData[i].data.key[0]);
        expect(valids2[i].key[1]).to.equal(validatorsCardanoData[i].data.key[1]);
        expect(valids2[i].key[2]).to.equal(validatorsCardanoData[i].data.key[2]);
        expect(valids2[i].key[3]).to.equal(validatorsCardanoData[i].data.key[3]);
      }
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
          key: [BigInt(4 * 5), BigInt(4 * 5 + 1), BigInt(4 * 5 + 2), BigInt(4 * 5 + 3)],
        },
      });

      await expect(
        validatorsc.connect(signer).setValidatorsChainData(1, validatorsCardanoData)
      ).to.revertedWithCustomError(validatorsc, "InvalidData");

      const data3 = await validatorsc.connect(validators[0]).getValidatorsChainData(1);
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

  describe("Registering new chain with Governance", function () {
    it("Should revert if setChainTokenQuantity is not called by fundAdmin", async function () {
      const { claims } = await loadFixture(deployBridgeFixture);

      await expect(claims.updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(claims, "NotFundAdmin");
    });

    it("Should revert if setChainTokenQuantity is called on unregistered chain", async function () {
      const { claims, validators } = await loadFixture(deployBridgeFixture);

      await claims.setFundAdmin(validators[0]);

      await expect(claims.connect(validators[0]).updateChainTokenQuantity(1, true, 100)).to.be.revertedWithCustomError(
        claims,
        "ChainIsNotRegistered"
      );
    });
    it("Should increase chainTokenQuantity after calling setChainTokenQuantity by fundAdmin", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await claims.setFundAdmin(validators[0]);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);

      await claims.connect(validators[0]).updateChainTokenQuantity(chain1.id, true, 100);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(200);
    });
    it("Should revert if decreae amount is higher than available chainTokenQuantity", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await claims.setFundAdmin(validators[0]);

      await expect(claims.connect(validators[0]).updateChainTokenQuantity(1, false, 200)).to.be.revertedWithCustomError(
        claims,
        "NegativeChainTokenAmount"
      );
    });
    it("Should decreae chainTokenQuantity by required amount", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.registerChain(chain1, 100, validatorsCardanoData);

      await claims.setFundAdmin(validators[0]);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100);

      await claims.connect(validators[0]).updateChainTokenQuantity(chain1.id, false, 50);

      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(50);
    });
  });
  describe("Setting FundAdmin", function () {
    it("Should revert setFundAdmin is not called by owner", async function () {
      const { claims, validators } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(validators[0]).setFundAdmin(validators[0])).to.be.revertedWithCustomError(
        claims,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert if FundAdmin is ZeroAddress", async function () {
      const { claims } = await loadFixture(deployBridgeFixture);

      await expect(claims.setFundAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(claims, "ZeroAddress");
    });

    it("Should set fundAdmin when called by Owner", async function () {
      const { claims, validators } = await loadFixture(deployBridgeFixture);

      await claims.setFundAdmin(validators[0].address);

      expect(await claims.fundAdmin()).to.be.equal(validators[0].address);
    });
    it("Should emit ChangedFundAdmin when new fundAdmin is set ", async function () {
      const { claims, validators } = await loadFixture(deployBridgeFixture);

      await expect(await claims.setFundAdmin(validators[0].address))
        .to.emit(claims, "FundAdminChanged")
        .withArgs(validators[0].address);
    });
  });
});
