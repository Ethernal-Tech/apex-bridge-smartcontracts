import { BridgeContract } from "./../typechain-types/BridgeContract";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5] =
      await ethers.getSigners();
    const validators = [
      validator1,
      validator2,
      validator3,
      validator4,
      validator5,
    ];

    const BridgeContract = await ethers.getContractFactory("BridgeContract");
    const bridgeContract = await BridgeContract.deploy(validators);

    const UTXOs = {
      multisigOwnedUTXOs: [],
      feePayerOwnedUTXOs: [],
    };

    const validatorClaims = {
      bridgingRequestClaims: [
      {
          observedTransactionHash: "0xabc...",
          receivers: [
              {
                  destinationAddress: "0x123...",
                  amount: 100
              }
          ],
          outputUTXO: {
              txHash: "0xdef...",
              txIndex: 0,
              addressUTXO: "0x456...",
              amount: 200
          },
          sourceChainID: "sourceChainID1",
          destinationChainID: "destinationChainID1"
      }
  ],
  batchExecutedClaims: [],
  batchExecutionFailedClaims: [],
  refundRequestClaims: [],
  refundExecutedClaims: [],
  blockHash: "0x123...",
  blockFullyObserved: true
};

    return { bridgeContract, owner, UTXOs, validators, validatorClaims };
  }

  describe("Deployment", function () {
    it("Should set 5 validator", async function () {
      const { bridgeContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await bridgeContract.getValidatorsCount();

      expect(numberOfValidators).to.equal(5);
    });
  });

  describe("Registering new chain", function () {
    it("Should reject proposal if not sent by validator", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await expect(
        bridgeContract
          .connect(owner)
          .registerChain("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWith("Not validator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");

      await expect(
        bridgeContract
          .connect(validators[0])
          .registerChain("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWith("Already proposed");
    });

    it("Should have correct number of votes for new chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(1);

      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(2);
    });

    it("Should emit new chain proposal", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await expect(
        bridgeContract
          .connect(validators[0])
          .registerChain("testChain", UTXOs, "0x", "0x")
      )
        .to.emit(bridgeContract, "newChainProposal")
        .withArgs("testChain", validators[0].address);
    });

    it("Should add new chain if there are enough votes", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.false;

      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.true;
    });
  });

  it("Should emit new chain registered", async function () {
    const { bridgeContract, validators, UTXOs } = await loadFixture(
      deployBridgeContractFixture
    );

    await bridgeContract
      .connect(validators[0])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await bridgeContract
      .connect(validators[1])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await bridgeContract
      .connect(validators[2])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await expect(
      bridgeContract
        .connect(validators[3])
        .registerChain("testChain", UTXOs, "0x", "0x")
    )
      .to.emit(bridgeContract, "newChainRegistered")
      .withArgs("testChain");
  });

  describe("Getting chains", function () {
    it("Should list all registered chains", async function () {
      const { bridgeContract, UTXOs, validators } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain 1", UTXOs, "0x", "0x");

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain 2", UTXOs, "0x", "0x");

      const chains = await bridgeContract.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal("testChain 1");
      expect(chains[1].id).to.equal("testChain 2");
    });
  });
  describe("Submit claim", function () {
    it("Should reject claim if not sent by validator", async function () {
      const { bridgeContract, owner, validatorClaims } = await loadFixture(
        deployBridgeContractFixture
      );

      await expect(
        bridgeContract
          .connect(owner)
          .submitClaims(validatorClaims)
      ).to.be.revertedWith("Not validator");
    });

    it("Should revert if same validator submits the same claim twice", async function () {
      const { bridgeContract, validators, validatorClaims } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(validators[0])
        .submitClaims(validatorClaims);

      await expect(
        bridgeContract
          .connect(validators[0])
          .submitClaims(validatorClaims)
      ).to.be.revertedWith("Already proposed");
    });

    it("Should have correct number of votes for new chain", async function () {
      const { bridgeContract, validators, validatorClaims } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .submitClaims(validatorClaims);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract
        .connect(validators[1])
        .submitClaims(validatorClaims);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new chain if there are enough votes", async function () {
      const { bridgeContract, validators, validatorClaims } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .submitClaims(validatorClaims);
      await bridgeContract
        .connect(validators[1])
        .submitClaims(validatorClaims);
      await bridgeContract
        .connect(validators[2])
        .submitClaims(validatorClaims);

      expect(await bridgeContract.isQueued(validatorClaims.bridgingRequestClaims[0])).to.be.false;

      await bridgeContract
        .connect(validators[3])
        .submitClaims(validatorClaims);

      expect(await bridgeContract.isQueued(validatorClaims.bridgingRequestClaims[0])).to.be.true;
    });
  });
});