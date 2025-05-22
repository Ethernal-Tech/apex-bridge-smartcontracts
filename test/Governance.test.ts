import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";
import { ethers, network } from "hardhat";

describe("Governance Functions", function () {
  describe("Owner Governor", function () {
    it("Should revert execution if there is no quorum", async function () {
      const {
        admin,
        bridge,
        claims,
        ownerGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateMaxNumberOfTransactions = admin.interface.encodeFunctionData("updateMaxNumberOfTransactions", [100]);

      const proposalTx = await ownerGovernor.propose(
        [admin.target],
        [0],
        [updateMaxNumberOfTransactions],
        "Update MaxNumber Of Transactions"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        ownerGovernor.execute(
          [admin.target],
          [0],
          [updateMaxNumberOfTransactions],
          ethers.keccak256(ethers.toUtf8Bytes("Update MaxNumber Of Transactions"))
        )
      ).to.be.revertedWith("Governor: proposal not successful");

      expect(await claims.maxNumberOfTransactions()).to.be.equal(2);
    });
    it("Should revert execution if voting period has not passed", async function () {
      const {
        admin,
        bridge,
        claims,
        ownerGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateMaxNumberOfTransactions = admin.interface.encodeFunctionData("updateMaxNumberOfTransactions", [100]);

      const proposalTx = await ownerGovernor.propose(
        [admin.target],
        [0],
        [updateMaxNumberOfTransactions],
        "Update MaxNumber Of Transactions"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);
      await ownerGovernor.connect(governor3).castVote(proposalId, 1);

      await expect(
        ownerGovernor.execute(
          [admin.target],
          [0],
          [updateMaxNumberOfTransactions],
          ethers.keccak256(ethers.toUtf8Bytes("Update MaxNumber Of Transactions"))
        )
      ).to.be.revertedWith("Governor: proposal not successful");

      expect(await claims.maxNumberOfTransactions()).to.be.equal(2);
    });
    it("Should revert if wrong governor", async function () {
      const {
        admin,
        bridge,
        claims,
        fundGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateMaxNumberOfTransactions = admin.interface.encodeFunctionData("updateMaxNumberOfTransactions", [100]);

      const proposalTx = await fundGovernor.propose(
        [admin.target],
        [0],
        [updateMaxNumberOfTransactions],
        "Update MaxNumber Of Transactions"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await fundGovernor.connect(governor1).castVote(proposalId, 1);
      await fundGovernor.connect(governor2).castVote(proposalId, 1);
      await fundGovernor.connect(governor3).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        fundGovernor.execute(
          [admin.target],
          [0],
          [updateMaxNumberOfTransactions],
          ethers.keccak256(ethers.toUtf8Bytes("Update MaxNumber Of Transactions"))
        )
      ).to.be.revertedWithCustomError(admin, "NotOwnerGovernor");

      expect(await claims.maxNumberOfTransactions()).to.be.equal(2);
    });
    it("Should execute if there is quorum and voting period has passed", async function () {
      const {
        admin,
        bridge,
        claims,
        ownerGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateMaxNumberOfTransactions = admin.interface.encodeFunctionData("updateMaxNumberOfTransactions", [100]);

      const proposalTx = await ownerGovernor.propose(
        [admin.target],
        [0],
        [updateMaxNumberOfTransactions],
        "Update MaxNumber Of Transactions"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);
      await ownerGovernor.connect(governor3).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        ownerGovernor.execute(
          [admin.target],
          [0],
          [updateMaxNumberOfTransactions],
          ethers.keccak256(ethers.toUtf8Bytes("Update MaxNumber Of Transactions"))
        )
      ).not.to.be.reverted;

      expect(await claims.maxNumberOfTransactions()).to.be.equal(100);
    });
  });
  describe("Fund Governor", function () {
    it("Should revert execution if there is no quorum", async function () {
      const {
        admin,
        bridge,
        fundGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateChainTokenQuantity = admin.interface.encodeFunctionData("updateChainTokenQuantity", [1, true, 50]);

      const proposalTx = await fundGovernor.propose(
        [admin.target],
        [0],
        [updateChainTokenQuantity],
        "Update Chain Token Quantity"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await fundGovernor.connect(governor1).castVote(proposalId, 1);
      await fundGovernor.connect(governor2).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        fundGovernor.execute(
          [admin.target],
          [0],
          [updateChainTokenQuantity],
          ethers.keccak256(ethers.toUtf8Bytes("Update Chain Token Quantity"))
        )
      ).to.be.revertedWith("Governor: proposal not successful");

      expect(await admin.getChainTokenQuantity(1)).to.be.equal(100);
    });

    it("Should revert execution if voting period has not passed", async function () {
      const {
        admin,
        bridge,
        fundGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateChainTokenQuantity = admin.interface.encodeFunctionData("updateChainTokenQuantity", [1, true, 50]);

      const proposalTx = await fundGovernor.propose(
        [admin.target],
        [0],
        [updateChainTokenQuantity],
        "Update Chain Token Quantity"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await fundGovernor.connect(governor1).castVote(proposalId, 1);
      await fundGovernor.connect(governor2).castVote(proposalId, 1);
      await fundGovernor.connect(governor3).castVote(proposalId, 1);

      await expect(
        fundGovernor.execute(
          [admin.target],
          [0],
          [updateChainTokenQuantity],
          ethers.keccak256(ethers.toUtf8Bytes("Update Chain Token Quantity"))
        )
      ).to.be.revertedWith("Governor: proposal not successful");

      expect(await admin.getChainTokenQuantity(1)).to.be.equal(100);
    });
    it("Should revert if wrong governor", async function () {
      const {
        admin,
        bridge,
        ownerGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateChainTokenQuantity = admin.interface.encodeFunctionData("updateChainTokenQuantity", [1, true, 50]);

      const proposalTx = await ownerGovernor.propose(
        [admin.target],
        [0],
        [updateChainTokenQuantity],
        "Update Chain Token Quantity"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await ownerGovernor.connect(governor1).castVote(proposalId, 1);
      await ownerGovernor.connect(governor2).castVote(proposalId, 1);
      await ownerGovernor.connect(governor3).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        ownerGovernor.execute(
          [admin.target],
          [0],
          [updateChainTokenQuantity],
          ethers.keccak256(ethers.toUtf8Bytes("Update Chain Token Quantity"))
        )
      ).to.be.revertedWithCustomError(admin, "NotFundGovernor");

      expect(await admin.getChainTokenQuantity(1)).to.be.equal(100);
    });
    it("Should execute if there is quorum and voting period has passed", async function () {
      const {
        admin,
        bridge,
        fundGovernor,
        ownerGovernorContract,
        governor1,
        governor2,
        governor3,
        chain1,
        validatorAddressChainData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(ownerGovernorContract).registerChain(chain1, 100, validatorAddressChainData);

      const updateChainTokenQuantity = admin.interface.encodeFunctionData("updateChainTokenQuantity", [1, true, 50]);

      const proposalTx = await fundGovernor.propose(
        [admin.target],
        [0],
        [updateChainTokenQuantity],
        "Update Chain Token Quantity"
      );
      const receipt = await proposalTx.wait();

      const event = receipt.logs.find((log) => log.fragment?.name === "ProposalCreated");

      const proposalId = event.args.proposalId.toString();

      //wait for voting delay to pass
      await network.provider.send("evm_mine");
      await network.provider.send("evm_mine");

      await fundGovernor.connect(governor1).castVote(proposalId, 1);
      await fundGovernor.connect(governor2).castVote(proposalId, 1);
      await fundGovernor.connect(governor3).castVote(proposalId, 1);

      //wait for voting period to pass
      for (let i = 0; i < 50; i++) {
        await network.provider.send("evm_mine");
      }

      await expect(
        fundGovernor.execute(
          [admin.target],
          [0],
          [updateChainTokenQuantity],
          ethers.keccak256(ethers.toUtf8Bytes("Update Chain Token Quantity"))
        )
      ).not.to.be.reverted;

      expect(await admin.getChainTokenQuantity(1)).to.be.equal(150);
    });
  });
});
