import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5, validator6] = await ethers.getSigners();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const BridgeContract = await ethers.getContractFactory("BridgeContract");
    const bridgeContract = await BridgeContract.deploy(validators);

    const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelper = await ClaimsHelper.deploy(bridgeContract.target);

    const ClaimsManager = await ethers.getContractFactory("ClaimsManager");
    const claimsManager = await ClaimsManager.deploy(bridgeContract.target, claimsHelper.target);

    const UTXOsManager = await ethers.getContractFactory("UTXOsManager");
    const uTXOsManager = await UTXOsManager.deploy(bridgeContract.target);

    await bridgeContract.setClaimsHelper(claimsHelper.target);
    await bridgeContract.setClaimsManager(claimsManager.target);
    await bridgeContract.setUTXOsManager(uTXOsManager.target);

    await claimsManager.setUTXOsManager(uTXOsManager.target);

    await claimsHelper.setClaimsManager(claimsManager.target);
    await claimsHelper.setUTXOsManager(uTXOsManager.target);

    await uTXOsManager.setClaimsManagerAddress(claimsManager.target);

    const UTXOs = {
      multisigOwnedUTXOs: [
        {
          txHash: "0xdef...",
          txIndex: 0,
          addressUTXO: "0x456...",
          amount: 200,
        },
        {
          txHash: "0xdef...",
          txIndex: 1,
          addressUTXO: "0x456...",
          amount: 100,
        },
        {
          txHash: "0xdef...",
          txIndex: 2,
          addressUTXO: "0x456...",
          amount: 50,
        },
      ],
      feePayerOwnedUTXOs: [
        {
          txHash: "0xdef...",
          txIndex: 0,
          addressUTXO: "0x456...",
          amount: 100,
        },
        {
          txHash: "0xdef...",
          txIndex: 1,
          addressUTXO: "0x456...",
          amount: 50,
        },
        {
          txHash: "0xdef...",
          txIndex: 2,
          addressUTXO: "0x456...",
          amount: 25,
        },
      ],
    };

    const validatorCardanoData = {
      keyHash: "Ox123...",
      keyHashFee: "keyHashFee...",
      verifyingKey: "0x0123456789abcdef",
      verifyingKeyFee: "0xabcdef0123456789",
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
          destinationChainID: "chainID1",
        },
      ],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsBRCerror = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: "0xabc...",
          receivers: [
            {
              destinationAddress: "0x123...11111111",
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
          destinationChainID: "chainID1",
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
            multisigOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 0,
                addressUTXO: "0x456...",
                amount: 201,
              },
            ],
            feePayerOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 2,
                addressUTXO: "0x456...",
                amount: 51,
              },
            ],
          },
        },
      ],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
      blockHash: "0x123...",
      blockFullyObserved: true,
    };

    const validatorClaimsBECerror = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          batchNonceID: 1111111111,
          outputUTXOs: {
            multisigOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 0,
                addressUTXO: "0x456...",
                amount: 201,
              },
            ],
            feePayerOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 2,
                addressUTXO: "0x456...",
                amount: 51,
              },
            ],
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

    const validatorClaimsBEFCerror = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          batchNonceID: 111111,
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

    const validatorClaimsRRCerror = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [
        {
          observedTransactionHash: "0xabc...",
          previousRefundTxHash: "previousRefundTxHash1",
          chainID: "chainID1",
          receiver: "receiver1111111111",
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

    const validatorClaimsRECerror = {
      bridgingRequestClaims: [],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [
        {
          observedTransactionHash: "0xabc...",
          chainID: "chainID1",
          refundTxHash: "refundTxHash11111111111",
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
      destinationChainId: "chainID1",
      rawTransaction: "rawTransaction1",
      multisigSignature: "multisigSignature1",
      feePayerMultisigSignature: "feePayerMultisigSignature1",
      includedTransactions: [
        {
          nonce: "0",
          receivers: [
            {
              destinationAddress: "0x123...",
              amount: 100,
            },
          ],
        },
      ],
      usedUTXOs: {
        multisigOwnedUTXOs: [
          {
            txHash: "0xdef...",
            txIndex: 0,
            addressUTXO: "0x456...",
            amount: 200,
          },
          {
            txHash: "0xdef...",
            txIndex: 1,
            addressUTXO: "0x456...",
            amount: 100,
          },
        ],
        feePayerOwnedUTXOs: [
          {
            txHash: "0xdef...",
            txIndex: 2,
            addressUTXO: "0x456...",
            amount: 50,
          },
        ],
      },
    };

    return {
      bridgeContract,
      claimsHelper,
      claimsManager,
      uTXOsManager,
      owner,
      UTXOs,
      validators,
      validator6,
      validatorCardanoData,
      validatorClaimsBRC,
      validatorClaimsBEC,
      validatorClaimsBEFC,
      validatorClaimsRRC,
      validatorClaimsREC,
      validatorClaimsBRCerror,
      validatorClaimsBECerror,
      validatorClaimsBEFCerror,
      validatorClaimsRRCerror,
      validatorClaimsRECerror,
      validatorClaimsRECObserverdFalse,
      signedBatch,
    };
  }

  describe("Deployment", function () {
    it("Should set 5 validator", async function () {
      const { bridgeContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await bridgeContract.getValidatorsCount();

      expect(numberOfValidators).to.equal(5);
    });

    it("Should return all ValidatorsCardanoData", async function () {
      const { bridgeContract, validators, validatorCardanoData } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).setValidatorCardanoData(validatorCardanoData, "chainID1");
      await bridgeContract.connect(validators[1]).setValidatorCardanoData(validatorCardanoData, "chainID1");
      await bridgeContract.connect(validators[2]).setValidatorCardanoData(validatorCardanoData, "chainID1");
      await bridgeContract.connect(validators[3]).setValidatorCardanoData(validatorCardanoData, "chainID1");
      await bridgeContract.connect(validators[4]).setValidatorCardanoData(validatorCardanoData, "chainID1");

      expect((await bridgeContract.getValidatorsCardanoData("chainID1")).length).to.equal(5);
      expect((await bridgeContract.getValidatorsCardanoData("chainID1"))[0].keyHash).to.equal(
        validatorCardanoData.keyHash
      );
      expect((await bridgeContract.getValidatorsCardanoData("chainID1"))[0].keyHashFee).to.equal(
        validatorCardanoData.keyHashFee
      );
      expect((await bridgeContract.getValidatorsCardanoData("chainID1"))[0].verifyingKey).to.equal(
        validatorCardanoData.verifyingKey
      );
      expect((await bridgeContract.getValidatorsCardanoData("chainID1"))[0].verifyingKeyFee).to.equal(
        validatorCardanoData.verifyingKeyFee
      );
    });

    it("Should revert if not called by validator", async function () {
      const { bridgeContract, validator6, validatorCardanoData } = await loadFixture(deployBridgeContractFixture);

      await expect(
        bridgeContract.connect(validator6).setValidatorCardanoData(validatorCardanoData, "chainID1")
      ).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
    });
  });

  describe("Registering new chain with Owner", function () {
    it("Should reject new chain if not set by owner", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(
        bridgeContract.connect(validators[0]).registerChain("chainID1", UTXOs, "0x", "0x", 100)
      ).to.be.revertedWithCustomError(bridgeContract, "NotOwner");
    });

    it("Should add new chain if requested by owner", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;
    });

    it("Should store UTXOs when new chain is registered by owner", async function () {
      const { bridgeContract, uTXOsManager, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
        UTXOs.multisigOwnedUTXOs[0].txHash
      );
      expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
        UTXOs.feePayerOwnedUTXOs[0].txHash
      );
    });

    it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
    });

    it("Should emit new chain registered when registered by owner", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100))
        .to.emit(bridgeContract, "newChainRegistered")
        .withArgs("chainID1");
    });
  });

  describe("Registering new chain with Governance", function () {
    it("Should reject proposal if chain is already registered with Governance", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;

      await expect(
        bridgeContract.connect(validators[4]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100)
      ).to.be.revertedWithCustomError(bridgeContract, "ChainAlreadyRegistered");
    });

    it("Should reject proposal if not sent by validator", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(
        bridgeContract.connect(owner).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100)
      ).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridgeContract, claimsHelper, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      await expect(
        bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should have correct number of votes for new chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.getNumberOfVotes("chainID1")).to.equal(1);

      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.getNumberOfVotes("chainID1")).to.equal(2);
    });

    it("Should emit new chain proposal", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100))
        .to.emit(bridgeContract, "newChainProposal")
        .withArgs("chainID1", validators[0].address);
    });

    it("Should add new chain if there are enough votes", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect(await bridgeContract.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
    });

    it("Should store UTXOs when new chain is registered with Governance", async function () {
      const { bridgeContract, uTXOsManager, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
        UTXOs.multisigOwnedUTXOs[0].txHash
      );
      expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
        UTXOs.feePayerOwnedUTXOs[0].txHash
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100);

      await expect(bridgeContract.connect(validators[3]).registerChainGovernance("chainID1", UTXOs, "0x", "0x", 100))
        .to.emit(bridgeContract, "newChainRegistered")
        .withArgs("chainID1");
    });

    it("Should list all registered chains", async function () {
      const { bridgeContract, UTXOs, validators } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[0]).registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[1]).registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[2]).registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", 100);
      await bridgeContract.connect(validators[3]).registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", 100);

      const chains = await bridgeContract.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal("chainID1 1");
      expect(chains[1].id).to.equal("chainID1 2");
    });
  });

  describe("Submit new Bridging Request Claim", function () {
    it("Should reject any claim if not sent by validator", async function () {
      const { bridgeContract, owner, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

      await expect(bridgeContract.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridgeContract,
        "NotValidator"
      );
    });

    it("Should revert if Bridging Request Claim is already confirmed", async function () {
      const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await expect(
        bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyConfirmed");
    });

    it("Should revert if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should have correct number of votes for new Bridging Request Claim", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Bridging Request Claim if there are enough votes", async function () {
      const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should increase claimsCounter after adding new Bridging Request Claim", async function () {
      const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      const claimsCounter = await claimsManager.claimsCounter(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID
      );

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsManager.claimsCounter(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      ).to.equal(claimsCounter + BigInt(1));
    });

    it("Should reject Bridging Request Claim if there is not enough bridging tokens", async function () {
      const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 1);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 1);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
      ).to.be.revertedWithCustomError(claimsHelper, "NotEnoughBridgingTokensAwailable");
    });

    it("Should revert if Bridging Request Claim do not match", async function () {
      const { bridgeContract, claimsHelper, owner, UTXOs, validators, validatorClaimsBRC, validatorClaimsBRCerror } =
        await loadFixture(deployBridgeContractFixture);

      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 1000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      await expect(
        bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRCerror)
      ).to.be.revertedWithCustomError(claimsHelper, "DoesNotMatchAreadyStoredClaim");
    });

    it("Should remove requred amount of tokens from source chain when Bridging Request Claim is confirmed", async function () {
      const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 1000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 1000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsManager.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID)
      ).to.equal(900);
    });
  });
  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if Batch Executed Claim is already confirmed", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBEC, signedBatch } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      await expect(
        bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBEC)
      ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
    });

    it("Should revert if same validator submits the same Batch Executed Claim twice", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert if Batch Executed Claim do not match", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsBEC, validatorClaimsBECerror } =
        await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      await expect(
        bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBECerror)
      ).to.be.revertedWithCustomError(claimsHelper, "DoesNotMatchAreadyStoredClaim");
    });

    it("Should have correct number of votes for new Batch Executed Claim", async function () {
      const { bridgeContract, validators, validatorClaimsBEC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Batch Executed Claim if there are enough votes", async function () {
      const { bridgeContract, claimsHelper, owner, validators, UTXOs, signedBatch, validatorClaimsBEC } =
        await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEC.batchExecutedClaims[0].chainID,
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEC.batchExecutedClaims[0].chainID,
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should add requred amount of tokens from source chain when Bridging Executed Claim is confirmed", async function () {
      const {
        bridgeContract,
        claimsManager,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
      } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 1000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 1000);

      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claimsManager.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(1100);
    });
  });
  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should revert if Batch Execution Failed Claims is already confirmed", async function () {
      const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      await expect(
        bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBEFC)
      ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
    });

    it("Should revert if same validator submits the same Batch Execution Failed Claims twice", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsBEFC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert if Batch Execution Failed Claims do not match", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsBEFC, validatorClaimsBEFCerror } =
        await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      await expect(
        bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFCerror)
      ).to.be.revertedWithCustomError(claimsHelper, "DoesNotMatchAreadyStoredClaim");
    });

    it("Should have correct number of votes for new Batch Execution Failed Claims", async function () {
      const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Batch Execution Failed Claims if there are enough votes", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsBEFC } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should reset current batch block and next timeout batch block when Batch Execution Failed Claims if confirmed", async function () {
      const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(
        await bridgeContract.currentBatchBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)
      ).to.equal(-1);
      expect(await bridgeContract.nextTimeoutBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)).to.equal(
        20
      );
    });
  });
  describe("Submit new Refund Request Claims", function () {
    it("Should revert if Refund Request Claims is already confirmed", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      await expect(
        bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
      ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
    });

    it("Should revert if same validator submits the same Refund Request Claims twice", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsRRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert if Refund Request Claims do not match", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsRRC, validatorClaimsRRCerror } =
        await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await expect(
        bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRCerror)
      ).to.be.revertedWithCustomError(claimsHelper, "DoesNotMatchAreadyStoredClaim");
    });

    it("Should have correct number of votes for new Refund Request Claims", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Refund Request Claims if there are enough votes", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsRRC } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsRRC.refundRequestClaims[0].chainID,
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsRRC.refundRequestClaims[0].chainID,
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should increase claimsCounter after adding new Refund Request Claim", async function () {
      const { bridgeContract, claimsManager, validators, validatorClaimsRRC } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      const claimsCounter = await claimsManager.claimsCounter(validatorClaimsRRC.refundRequestClaims[0].chainID);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claimsManager.claimsCounter(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.equal(
        claimsCounter + BigInt(1)
      );
    });
  });
  describe("Submit new Refund Executed Claim", function () {
    it("Should revert if Refund Executed Claim is already confirmed", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      await expect(
        bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
      ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
    });

    it("Should revert if same validator submits the same Refund Executed Claim twice", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsREC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

      await expect(
        bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should revert if Refund Executed Claims do not match", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsREC, validatorClaimsRECerror } =
        await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

      await expect(
        bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRECerror)
      ).to.be.revertedWithCustomError(claimsHelper, "DoesNotMatchAreadyStoredClaim");
    });

    it("Should have correct number of votes for new Refund Executed Claim", async function () {
      const { bridgeContract, validators, validatorClaimsREC } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(1);

      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsREC);

      expect(await bridgeContract.getNumberOfVotes("0xabc...")).to.equal(2);
    });

    it("Should add new Refund Executed Claim if there are enough votes", async function () {
      const { bridgeContract, claimsHelper, validators, validatorClaimsREC } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsREC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsREC.refundExecutedClaims[0].chainID,
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsREC.refundExecutedClaims[0].chainID,
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });
  });
  describe("Batch creation", function () {
    it("ShouldCreateBatch should return false if there is not enough validated claims and no pending signedClaims from validator", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to
        .be.false;
    });

    it("ShouldCreateBatch should return true if there is enough validated claims and no pending batches", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 100);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 100);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to
        .be.true;
    });

    it("ShouldCreateBatch should return false if there is not enough validated claims and no timeout and no pending batch", async function () {
      const { bridgeContract, validators, owner, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to
        .be.false;
    });

    it("ShouldCreateBatch should return true if there is not enough validated claims but did timeout and no pending signedClaims from validator", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      //no destinatin chain registered, so currentBatchBlock for that chain is 0

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to
        .be.false;
    });

    it("ShouldCreateBatch should return true if there is timeout and no pending batch", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to
        .be.true;
    });

    it("Should set proper last block hash in lastObservedBlock if block is fully observerd", async function () {
      const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await bridgeContract.getLastObservedBlock(validatorClaimsRRC.refundRequestClaims[0].chainID)).to.equal(
        validatorClaimsRRC.blockHash
      );
    });

    it("Should not change block hash in lastObservedBlock if block is not fully observerd", async function () {
      const { bridgeContract, validators, validatorClaimsRECObserverdFalse } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRECObserverdFalse);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRECObserverdFalse);

      expect(
        await bridgeContract.getLastObservedBlock(validatorClaimsRECObserverdFalse.refundExecutedClaims[0].chainID)
      ).to.equal("");
    });

    it("SignedBatch should be added to signedBatches", async function () {
      const { bridgeContract, validators, signedBatch } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);

      expect(
        (await bridgeContract.connect(validators[0]).signedBatches(signedBatch.destinationChainId, signedBatch.id, 0))
          .id
      ).to.equal(signedBatch.id);
      expect(
        (await bridgeContract.connect(validators[0]).signedBatches(signedBatch.destinationChainId, signedBatch.id, 0))
          .rawTransaction
      ).to.equal(signedBatch.rawTransaction);
      expect(
        (await bridgeContract.connect(validators[0]).signedBatches(signedBatch.destinationChainId, signedBatch.id, 0))
          .multisigSignature
      ).to.equal(signedBatch.multisigSignature);
      expect(
        (await bridgeContract.connect(validators[0]).signedBatches(signedBatch.destinationChainId, signedBatch.id, 0))
          .feePayerMultisigSignature
      ).to.equal(signedBatch.feePayerMultisigSignature);
    });

    it("Should create ConfirmedBatch if there is enough votes", async function () {
      const { bridgeContract, validators, signedBatch } = await loadFixture(deployBridgeContractFixture);
      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).rawTransaction
      ).to.equal(signedBatch.rawTransaction);
      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .multisigSignatures.length
      ).to.equal(4);
      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .feePayerMultisigSignatures.length
      ).to.equal(4);

      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .multisigSignatures[0]
      ).to.equal("multisigSignature1");
      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .multisigSignatures[1]
      ).to.equal("multisigSignature1");
      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .multisigSignatures[2]
      ).to.equal("multisigSignature1");
      expect(
        (await bridgeContract.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .multisigSignatures[3]
      ).to.equal("multisigSignature1");
    });

    it("Should return confirmedTransactions from confirmed BridgeRequestClaims", async function () {
      const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID, UTXOs, "0x", "0x", 10000);
      await bridgeContract
        .connect(owner)
        .registerChain(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID, UTXOs, "0x", "0x", 10000);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const confirmedTransactions = await bridgeContract
        .connect(validators[0])
        .getConfirmedTransactions.staticCall(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);

      expect(confirmedTransactions.length).to.equal(1);
      expect(confirmedTransactions[0].receivers[0].destinationAddress).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress
      );
      expect(confirmedTransactions[0].receivers[0].amount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount
      );
    });
  });
  describe("UTXO management", function () {
    it("Should return required amount of UTXOs", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      const utxos = await bridgeContract.getAvailableUTXOs("chainID1", 100);

      expect(utxos.multisigOwnedUTXOs[0].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[0].txIndex);
      expect(utxos.feePayerOwnedUTXOs[0].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[0].txIndex);
    });

    it("Should return required amount of UTXOs in multiple UTXOs if needed", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      const utxos = await bridgeContract.getAvailableUTXOs("chainID1", 250);

      expect(utxos.multisigOwnedUTXOs.length).to.equal(2);
      expect(utxos.multisigOwnedUTXOs[0].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[0].txIndex);
      expect(utxos.multisigOwnedUTXOs[1].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[1].txIndex);
      expect(utxos.feePayerOwnedUTXOs[0].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[0].txIndex);
    });

    it("Should remove used UTXOs and add out new UTXOs when Bridge Execution Claim is confirmed", async function () {
      const { bridgeContract, uTXOsManager, owner, validators, UTXOs, signedBatch, validatorClaimsBEC } =
        await loadFixture(deployBridgeContractFixture);

      await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", 100);

      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs.length).to.equal(
        UTXOs.multisigOwnedUTXOs.length
      );
      expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs.length).to.equal(
        UTXOs.feePayerOwnedUTXOs.length
      );

      await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs.length).to.equal(2);
      expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs.length).to.equal(3);

      // remaining not used UTXOs
      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].amount).to.equal(50);
      // newly added UTXOs
      expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[1].amount).to.equal(201);
    });
  });
});
