import { BridgeContractClaimsManager } from './../typechain-types/BridgeContractClaimsManager';
//import { BridgeContract } from "./../typechain-types/BridgeContract";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5] = await ethers.getSigners();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const BridgeContract = await ethers.getContractFactory("BridgeContract");
    const bridgeContract = await BridgeContract.deploy(validators);

    const address = await bridgeContract.getBridgeContractClaimsManager();

    const bridgeContractClaimsManager = await ethers.getContractAt("BridgeContractClaimsManager", address);

    const UTXOs = {
      multisigOwnedUTXOs: [],
      feePayerOwnedUTXOs: [],
    };

    const validatorClaimsBRC = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: "0xabc...",
          receivers: [
            {
              destinationAddress: "0x123...",
              amount: 100,
            },
          ],
          outputUTXO: {
            txHash: "0xdef...",
            txIndex: 0,
            addressUTXO: "0x456...",
            amount: 200,
          },
          sourceChainID: "sourceChainID1",
          destinationChainID: "destinationChainID1",
        },
      ],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsBEC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          batchNonceID: 1,
          outputUTXOs: {
              multisigOwnedUTXOs: [],
              feePayerOwnedUTXOs: [],
          },
        },
      ],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsBEFC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          batchNonceID: 1,
        },
      ],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsRRC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [
        {
        observedTransactionHash: "0xabc...",
        previousRefundTxHash: "previousRefundTxHash1",
        chainID: "chainID1",
        receiver: "receiver1",
        utxo: {
          txHash: "0xdef...",
          txIndex: 0,
          addressUTXO: "0x456...",
          amount: 200,
        },
        rawTransaction: "rawTransaction1",
        multisigSignature: "multisigSignature1",
        retryCounter: 1,
        },
      ],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsREC = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          refundTxHash: "refundTxHash1",
          utxo: {
            txHash: "0xdef...",
            txIndex: 0,
            addressUTXO: "0x456...",
            amount: 200,
          },
        },
      ],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsRECObserverdFalse = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          refundTxHash: "refundTxHash1",
          utxo: {
            txHash: "0xdef...",
            txIndex: 0,
            addressUTXO: "0x456...",
            amount: 200,
          },
        },
      ],
      blockHash: "0x123...",
      blockFullyObserved: false,
    };

    const signedBatch = {
      id: "1",
      destinationChainId: "destinationChainId1",
      rawTransaction: "rawTransaction1",
      multisigSignature: "multisigSignature1",
      feePayerMultisigSignature: "feePayerMultisigSignature1",
      includedTransactions: [],
      usedUTXOs: {
        multisigOwnedUTXOs: [],
        feePayerOwnedUTXOs: [],
      },
    };

    return { bridgeContract, bridgeContractClaimsManager, owner, UTXOs, validators, validatorClaimsBRC, 
      validatorClaimsBEC, validatorClaimsBEFC, validatorClaimsRRC, validatorClaimsREC, 
      validatorClaimsRECObserverdFalse, signedBatch };
  }

  describe("Deployment", function () {
    it("Should set 5 validator", async function () {
      const { bridgeContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await bridgeContract.getValidatorsCount();

      expect(numberOfValidators).to.equal(5);
    });
  });

  describe("Registering new chain with Owner", function () {
    it("Should reject new chain if not set by owner", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(
        bridgeContract.connect(validators[0]).registerChain("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWithCustomError(bridgeContract, "NotOwner");
    });

    it("Should add new chain if requested by owner", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.true;
    });


    it("Should emit new chain registered when registered by owner", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(owner).registerChain("testChain", UTXOs, "0x", "0x"))
        .to.emit(bridgeContract, "newChainRegistered")
        .withArgs("testChain");
    });
  });

  describe("Registering new chain with Governance", function () {
    it("Should reject proposal if not sent by validator", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(
        bridgeContract.connect(owner).registerChainGovernance("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      await expect(
        bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");

    });

    it("Should have correct number of votes for new chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(1);

      await bridgeContract.connect(validators[1]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(2);
    });

    it("Should emit new chain proposal", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x"))
        .to.emit(bridgeContract, "newChainProposal")
        .withArgs("testChain", validators[0].address);
    });

    it("Should add new chain if there are enough votes", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[1]).registerChainGovernance("testChain", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[2]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.false;

      await bridgeContract.connect(validators[3]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.true;
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      await bridgeContract.connect(validators[1]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      await bridgeContract.connect(validators[2]).registerChainGovernance("testChain", UTXOs, "0x", "0x");

      await expect(bridgeContract.connect(validators[3]).registerChainGovernance("testChain", UTXOs, "0x", "0x"))
        .to.emit(bridgeContract, "newChainRegistered")
        .withArgs("testChain");
    });
  });

    it("Should list all registered chains", async function () {
      const { bridgeContract, UTXOs, validators } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[1]).registerChainGovernance("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[2]).registerChainGovernance("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[3]).registerChainGovernance("testChain 1", UTXOs, "0x", "0x");

      await bridgeContract.connect(validators[0]).registerChainGovernance("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[1]).registerChainGovernance("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[2]).registerChainGovernance("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract.connect(validators[3]).registerChainGovernance("testChain 2", UTXOs, "0x", "0x");

      const chains = await bridgeContract.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal("testChain 1");
      expect(chains[1].id).to.equal("testChain 2");
    });

  describe("Submit new Bridging Request Claim", function () {
    it("Should reject any claim if not sent by validator", async function () {
      const { bridgeContract, owner, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
    });

    it("Should revert if Bridging Request Claim is already in the queue", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await expect(bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyQueued");
    });

    it("Should revert if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      await expect(bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Bridging Request Claim", async function () {
      const { bridgeContract, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Bridging Request Claim if there are enough votes", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContractClaimsManager.isQueuedBRC(validatorClaimsBRC.bridgingRequestClaims[0])).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContractClaimsManager.isQueuedBRC(validatorClaimsBRC.bridgingRequestClaims[0])).to.be.true;
    });

    it("Should increase claimsCounter after adding new Bridging Request Claim", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      const claimsCounter = await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID)).to.equal(claimsCounter + BigInt(1));
    });
  });
  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if Batch Executed Claim is already in the queue", async function () {
      const { bridgeContract, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      await expect(bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(bridgeContract, "AlreadyQueued");
    });

    it("Should revert if same validator submits the same Batch Executed Claim twice", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      await expect(bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Batch Executed Claim", async function () {
      const { bridgeContract, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Batch Executed Claim if there are enough votes", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContractClaimsManager.isQueuedBEC(validatorClaimsBEC.batchExecutedClaims[0])).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContractClaimsManager.isQueuedBEC(validatorClaimsBEC.batchExecutedClaims[0])).to.be.true;
    });
    it("Should increase claimsCounter after adding new Batch Executed Claim", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);

      const claimsCounter = await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBEC.batchExecutedClaims[0].chainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(claimsCounter + BigInt(1));
    });
  });
  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should revert if Batch Execution Failed Claims is already in the queue", async function () {
      const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      await expect(bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC)).to.be.revertedWithCustomError(bridgeContract, "AlreadyQueued");
    });

    it("Should revert if same validator submits the same Batch Execution Failed Claims twice", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      await expect(bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Batch Execution Failed Claims", async function () {
      const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Batch Execution Failed Claims if there are enough votes", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContractClaimsManager.isQueuedBEFC(validatorClaimsBEFC.batchExecutionFailedClaims[0])).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContractClaimsManager.isQueuedBEFC(validatorClaimsBEFC.batchExecutionFailedClaims[0])).to.be.true;
    });
    it("Should increase claimsCounter after adding new Batch Executed Claim", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      const claimsCounter = await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)).to.equal(claimsCounter + BigInt(1));
    });
  });
  describe("Submit new Refund Request Claims", function () {
    it("Should revert if Refund Request Claims is already in the queue", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      await expect(bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(bridgeContract, "AlreadyQueued");
    });

    it("Should revert if same validator submits the same Refund Request Claims twice", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await expect(bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Refund Request Claims", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Refund Request Claims if there are enough votes", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContractClaimsManager.isQueuedRRC(validatorClaimsRRC.refundRequestClaims[0])).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContractClaimsManager.isQueuedRRC(validatorClaimsRRC.refundRequestClaims[0])).to.be.true;
    });

    it("Should increase claimsCounter after adding new Batch Executed Claim", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const claimsCounter = await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsRRC.refundRequestClaims[0].chainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.equal(claimsCounter + BigInt(1));
    });
  });
  describe("Submit new Refund Executed Claim", function () {
    it("Should revert if Refund Executed Claim is already in the queue", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      await expect(bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(bridgeContract, "AlreadyQueued");
    });

    it("Should revert if same validator submits the same Refund Executed Claim twice", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsREC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

      await expect(bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC)).to.be.revertedWithCustomError(bridgeContractClaimsManager, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Refund Executed Claim", async function () {
      const { bridgeContract, validators, validatorClaimsREC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsREC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Refund Executed Claim if there are enough votes", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsREC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsREC);

      expect(await bridgeContractClaimsManager.isQueuedREC(validatorClaimsREC.refundExecutedClaims[0])).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(await bridgeContractClaimsManager.isQueuedREC(validatorClaimsREC.refundExecutedClaims[0])).to.be.true;
    });

    it("Should increase claimsCounter after adding new Refund Executed Claim", async function () {
      const { bridgeContract, bridgeContractClaimsManager, validators, validatorClaimsREC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsREC);

      const claimsCounter = await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsREC.refundExecutedClaims[0].chainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(await bridgeContractClaimsManager.getClaimsCounter(validatorClaimsREC.refundExecutedClaims[0].chainID)).to.equal(claimsCounter + BigInt(1));
    });
  });
  describe("Batch creation", function () {
    it("ShouldCreateBatch should return false if theres not enough validated claims", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.be.false;

    });
    it("ShouldCreateBatch should return true if there is not enough validated claims", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.be.true;
    });

    it("ShouldCreateBatch should return false if there is not enough validated claims and no timeout", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.be.false;
    });
    it("ShouldCreateBatch should return true if there is not enough validated claims but did timeout", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      //every await in this describe is one block, so we need to wait 1 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send('evm_mine');

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.be.true;
    });
    
    it("Should set proper last block hash in lastObservedBlock if block is fully observerd", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getLastObservedBlock(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.equal(validatorClaimsRRC.blockHash);
    });

    it("Should not change block hash in lastObservedBlock if block is not fully observerd", async function () {
      const { bridgeContract, validators, validatorClaimsRECObserverdFalse } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRECObserverdFalse);

      expect(await bridgeContract.getLastObservedBlock(validatorClaimsRECObserverdFalse.refundExecutedClaims[0].chainID)).to.equal('');
    });

    it("Should not change block hash in lastObservedBlock if block is not fully observerd", async function () {
      const { bridgeContract, validators, validatorClaimsRECObserverdFalse } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRECObserverdFalse);

      expect(await bridgeContract.getLastObservedBlock(validatorClaimsRECObserverdFalse.refundExecutedClaims[0].chainID)).to.equal('');
    });

    it("SignedBatch should be added to signedBatches", async function () {
      const { bridgeContract, validators, signedBatch } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);

      expect((await bridgeContract.connect(validators[0]).getSignedBatches(signedBatch.id))[0].id).to.equal(signedBatch.id);
      expect((await bridgeContract.connect(validators[0]).getSignedBatches(signedBatch.id))[0].rawTransaction).to.equal(signedBatch.rawTransaction);
      expect((await bridgeContract.connect(validators[0]).getSignedBatches(signedBatch.id))[0].multisigSignature).to.equal(signedBatch.multisigSignature);
      expect((await bridgeContract.connect(validators[0]).getSignedBatches(signedBatch.id))[0].feePayerMultisigSignature).to.equal(signedBatch.feePayerMultisigSignature);
    });

    it("Should create ConfirmedBatch if there is enough votes", async function () {
      // const { bridgeContract, validators, signedBatch } = await loadFixture(deployBridgeContractFixture);
      // await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      // await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      // await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      // await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      //expect((await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.id)).id).to.equal(signedBatch.id);
      //expect((await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.rawTransaction)).id).to.equal(signedBatch.rawTransaction);
      //expect((await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.rawTransaction)).id).to.equal(signedBatch.rawTransaction);
    });

  });
});