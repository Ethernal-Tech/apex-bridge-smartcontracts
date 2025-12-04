import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployBridgeFixture } from "../test/fixtures";
import { ZeroAddress } from "ethers";

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
      await expect(
        bridge.connect(validators[0]).registerChain(chain1, 100, validatorAddressChainData)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if there is less than 4 validatorAddressChainData", async function () {
      const validatorAddressChainData_empty = new Array();

      await expect(
        bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData_empty)
      ).to.be.revertedWithCustomError(bridge, "InvalidData");
    });

    it("Should revert if validator's address is zero", async function () {
      const validatorAddressChainData_zeroAddress = validators.map((val, index) => ({
        addr: ZeroAddress,
        data: {
          key: [
            (4n * BigInt(index)).toString(),
            (4n * BigInt(index) + 1n).toString(),
            (4n * BigInt(index) + 2n).toString(),
            (4n * BigInt(index) + 3n).toString(),
          ],
        },
        keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      }));

      await expect(
        bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData_zeroAddress)
      ).to.be.revertedWithCustomError(bridge, "ZeroAddress");
    });

    it("Should revert Cardano chain proposal if validator message is not signed correctly", async function () {
      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3");

      await expect(
        bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData)
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should revert Nexus chain proposal if validator message is not signed correctly", async function () {
      await setCode("0x0000000000000000000000000000000000002060", "0x60206000F3");

      await expect(
        bridge.connect(owner).registerChain(chain2, 100, validatorAddressChainData)
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should add new chain if requested by owner", async function () {
      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should update chain if requested by owner and chain already exists", async function () {
      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
      expect(await bridge.getAllRegisteredChains()).to.have.length(1);
      expect((await bridge.getAllRegisteredChains())[0].id).to.equal(1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100); //it should not be changed
      expect(await validatorsc.getValidatorsChainData(chain1.id)).to.have.length(5);
      expect((await validatorsc.getValidatorsChainData(chain1.id))[0].key[0]).to.equal(
        validatorAddressChainData[0].data.key[0]
      );

      validatorAddressChainData[0].data.key[0] = BigInt(10);

      await bridge.connect(owner).registerChain(chain1, 10, validatorAddressChainData);
      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
      expect(await bridge.getAllRegisteredChains()).to.have.length(1);
      expect((await bridge.getAllRegisteredChains())[0].id).to.equal(1);
      expect(await claims.chainTokenQuantity(chain1.id)).to.equal(100); //it should not be changed
      expect(await validatorsc.getValidatorsChainData(chain1.id)).to.have.length(5);
      expect((await validatorsc.getValidatorsChainData(chain1.id))[0].key[0]).to.equal(
        validatorAddressChainData[0].data.key[0]
      );

      validatorAddressChainData[0].data.key[0] = BigInt(0);
    });

    it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(0);

      await bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData);
      expect(await claims.nextTimeoutBlock(chain1.id)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by owner after chain registration through governance", async function () {
      await expect(bridge.connect(owner).registerChain(chain1, 100, validatorAddressChainData))
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });
    it("setChainAdditionalData should be allowed for owner", async function () {
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
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[4].data,
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
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
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
          validatorAddressChainData[3].data,
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
          validatorAddressChainData[4].data,
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
            validatorAddressChainData[4].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should revert proposal if not sent by validator", async function () {
      await expect(
        bridge
          .connect(owner)
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorAddressChainData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
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
            validatorAddressChainData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert Cardano chain proposal if validator message is not signed correctly", async function () {
      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3");

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorAddressChainData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should revert Nexus chain proposal if validator message is not signed correctly", async function () {
      await setCode("0x0000000000000000000000000000000000002060", "0x60206000F3");

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain2.id,
            chain2.chainType,
            100,
            validatorAddressChainData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      ).to.be.revertedWithCustomError(bridge, "InvalidSignature");
    });

    it("Should emit new chain proposal", async function () {
      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance(
            chain1.id,
            chain1.chainType,
            100,
            validatorAddressChainData[0].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      )
        .to.emit(bridge, "newChainProposal")
        .withArgs(1, validators[0].address);
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[3].data,
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
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[3].data,
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
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      expect(await claims.nextTimeoutBlock(1)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[3].data,
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
            validatorAddressChainData[4].data,
            "0x7465737400000000000000000000000000000000000000000000000000000000",
            "0x7465737400000000000000000000000000000000000000000000000000000000"
          )
      )
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });

    it("Should list all registered chains", async function () {
      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain1.id,
          chain1.chainType,
          100,
          validatorAddressChainData[4].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );

      await bridge
        .connect(validators[0])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorAddressChainData[0].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[1])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorAddressChainData[1].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[2])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorAddressChainData[2].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[3])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorAddressChainData[3].data,
          "0x7465737400000000000000000000000000000000000000000000000000000000",
          "0x7465737400000000000000000000000000000000000000000000000000000000"
        );
      await bridge
        .connect(validators[4])
        .registerChainGovernance(
          chain2.id,
          chain2.chainType,
          100,
          validatorAddressChainData[4].data,
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

      for (let i = 0; i < validatorAddressChainData.length; i++) {
        expect(valids1[i].key[0]).to.equal(validatorAddressChainData[i].data.key[0]);
        expect(valids1[i].key[1]).to.equal(validatorAddressChainData[i].data.key[1]);
        expect(valids1[i].key[2]).to.equal(validatorAddressChainData[i].data.key[2]);
        expect(valids1[i].key[3]).to.equal(validatorAddressChainData[i].data.key[3]);

        expect(valids2[i].key[0]).to.equal(validatorAddressChainData[i].data.key[0]);
        expect(valids2[i].key[1]).to.equal(validatorAddressChainData[i].data.key[1]);
        expect(valids2[i].key[2]).to.equal(validatorAddressChainData[i].data.key[2]);
        expect(valids2[i].key[3]).to.equal(validatorAddressChainData[i].data.key[3]);
      }
    });

    it("Should not update Validators Cardano Data until length of the list with the new data doesn't match the number of validators", async function () {
      const bridgeAddress = await bridge.getAddress();

      const signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      validatorAddressChainData.push({
        addr: owner.address,
        data: {
          key: [BigInt(4 * 5), BigInt(4 * 5 + 1), BigInt(4 * 5 + 2), BigInt(4 * 5 + 3)],
        },
        keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      });

      await expect(
        validatorsc.connect(signer).setValidatorsChainData(1, validatorAddressChainData)
      ).to.revertedWithCustomError(validatorsc, "InvalidData");

      const data3 = await validatorsc.connect(validators[0]).getValidatorsChainData(1);
      expect(validatorAddressChainData.length).to.be.greaterThan(validators.length);
      expect(data3.length).to.equal(0);

      validatorAddressChainData.pop();

      expect(validatorAddressChainData.length).to.equal(validators.length);

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });
    });
  });

  let bridge: any;
  let claimsHelper: any;
  let claims: any;
  let owner: any;
  let chain1: any;
  let chain2: any;
  let validatorsc: any;
  let validatorAddressChainData: any;
  let validators: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    claimsHelper = fixture.claimsHelper;
    claims = fixture.claims;
    owner = fixture.owner;
    chain1 = fixture.chain1;
    chain2 = fixture.chain2;
    validatorsc = fixture.validatorsc;
    validatorAddressChainData = fixture.validatorAddressChainData;
    validators = fixture.validators;
  });
});
