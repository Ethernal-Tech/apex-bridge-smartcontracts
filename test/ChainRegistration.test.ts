import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { artifacts, ethers } from "hardhat";
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
        bridge
          .connect(validators[0])
          .registerChain(
            chain1,
            100,
            validatorsCardanoData,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert Cardano chain proposal if validator message is not signed correctly", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3");

      await expect(
        bridge
          .connect(owner)
          .registerChain(
            chain1,
            100,
            validatorsCardanoData,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should revert Nexus chain proposal if validator message is not signed correctly", async function () {
      const { bridge, owner, chain2, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await setCode("0x0000000000000000000000000000000000002060", "0x60206000F3");

      await expect(
        bridge
          .connect(owner)
          .registerChain(
            chain2,
            100,
            validatorsCardanoData,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should add new chain if requested by owner", async function () {
      const { bridge, claims, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(owner)
        .registerChain(
          chain1,
          100,
          validatorsCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should update chain if requested by owner and chain already exists", async function () {
      const { bridge, claims, validatorsc, owner, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(owner)
        .registerChain(
          chain1,
          100,
          validatorsCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
      expect(await bridge.getAllRegisteredChains()).to.have.length(1);
      expect((await bridge.getAllRegisteredChains())[0].id).to.equal(1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100); //it should not be changed
      expect(await validatorsc.getValidatorsChainData(chain1.id)).to.have.length(5);
      expect((await validatorsc.getValidatorsChainData(chain1.id))[0].key[0]).to.equal(
        validatorsCardanoData[0].data.key[0]
      );

      validatorsCardanoData[0].data.key[0] = BigInt(10);

      await bridge
        .connect(owner)
        .registerChain(
          chain1,
          10,
          validatorsCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
      expect(await bridge.getAllRegisteredChains()).to.have.length(1);
      expect((await bridge.getAllRegisteredChains())[0].id).to.equal(1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100); //it should not be changed
      expect(await validatorsc.getValidatorsChainData(chain1.id)).to.have.length(5);
      expect((await validatorsc.getValidatorsChainData(chain1.id))[0].key[0]).to.equal(
        validatorsCardanoData[0].data.key[0]
      );

      validatorsCardanoData[0].data.key[0] = BigInt(0);
    });

    it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
      const { bridge, claims, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(0);

      await bridge
        .connect(owner)
        .registerChain(
          chain1,
          100,
          validatorsCardanoData,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by owner", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge
          .connect(owner)
          .registerChain(
            chain1,
            100,
            validatorsCardanoData,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      )
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
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[4].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

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
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[4].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[4].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should revert proposal if not sent by validator", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge
          .connect(owner)
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridge, claimsHelper, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert Cardano chain proposal if validator message is not signed correctly", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3");

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should revert Nexus chain proposal if validator message is not signed correctly", async function () {
      const { bridge, validators, chain2, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await setCode("0x0000000000000000000000000000000000002060", "0x60206000F3");

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain2.id,
            chain2.chainType,
            100,
            validatorsCardanoData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should emit new chain proposal", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      )
        .to.emit(bridge, "newChainProposal")
        .withArgs(1, validators[0].address);
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.nextTimeoutBlock(1)).to.equal(BigInt(0));

      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.nextTimeoutBlock(1)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorsCardanoData[4].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      )
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });

    it("Should list all registered chains", async function () {
      const { bridge, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorsCardanoData[4].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorsCardanoData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorsCardanoData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorsCardanoData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorsCardanoData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorsCardanoData[4].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

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

  it("setChainAdditionalData should be allowed for owner", async function () {
    const { bridge, chain1, owner, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);
    const [multisigAddr, feeAddr] = ["0xff0033", "0x0007788aa"];

    await expect(
      bridge.connect(owner).setChainAdditionalData(chain1.id, multisigAddr, feeAddr)
    ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");

    await expect(
      bridge.connect(validators[0]).setChainAdditionalData(chain1.id, multisigAddr, feeAddr)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await bridge
      .connect(validators[0])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        validatorsCardanoData[0].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[1])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        validatorsCardanoData[1].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[2])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        validatorsCardanoData[2].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[3])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        validatorsCardanoData[3].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );
    await bridge
      .connect(validators[4])
      .registerChainGovernance(
        chain1.id,
        chain1.chainType,
        100,
        validatorsCardanoData[4].data,
        "0x7465737400000000000000000000000000000000000000000000000000000000",
        "0x7465737400000000000000000000000000000000000000000000000000000000"
      );

    await bridge.connect(owner).setChainAdditionalData(chain1.id, multisigAddr, feeAddr);

    const chains = await bridge.getAllRegisteredChains();
    expect(chains.length).to.equal(1);
    expect(chains[0].id).to.equal(1);
    expect(chains[0].addressMultisig).to.equal(multisigAddr);
    expect(chains[0].addressFeePayer).to.equal(feeAddr);
  });
});
