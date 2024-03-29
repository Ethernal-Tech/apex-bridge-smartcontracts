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

    const SlotsManager = await ethers.getContractFactory("SlotsManager");
    const slotsManager = await SlotsManager.deploy(bridgeContract.target);

    const SignedBatchManager = await ethers.getContractFactory("SignedBatchManager");
    const signedBatchManager = await SignedBatchManager.deploy(
      bridgeContract.target,
      claimsManager.target,
      claimsHelper.target,
      uTXOsManager.target
    );

    await bridgeContract.setSlotsManager(slotsManager.target);
    await bridgeContract.setClaimsHelper(claimsHelper.target);
    await bridgeContract.setClaimsManager(claimsManager.target);
    await bridgeContract.setUTXOsManager(uTXOsManager.target);
    await bridgeContract.setSignedBatchManager(signedBatchManager.target);

    await claimsManager.setUTXOsManager(uTXOsManager.target);
    await claimsManager.setSignedBatchManager(signedBatchManager.target);

    await claimsHelper.setClaimsManager(claimsManager.target);
    await claimsHelper.setSignedBatchManagerAddress(signedBatchManager.target);

    await uTXOsManager.setClaimsManagerAddress(claimsManager.target);
    await uTXOsManager.setSignedBatchManagerAddress(signedBatchManager.target);

    const UTXOs = {
      multisigOwnedUTXOs: [
        {
          txHash: "0xdef...",
          txIndex: 0,
          nonce: 0,
          amount: 200,
        },
        {
          txHash: "0xdef...",
          txIndex: 1,
          nonce: 0,
          amount: 100,
        },
        {
          txHash: "0xdef...",
          txIndex: 2,
          nonce: 0,
          amount: 50,
        },
      ],
      feePayerOwnedUTXOs: [
        {
          txHash: "0xdef...",
          txIndex: 0,
          nonce: 0,
          amount: 100,
        },
        {
          txHash: "0xdef...",
          txIndex: 1,
          nonce: 0,
          amount: 50,
        },
        {
          txHash: "0xdef...",
          txIndex: 2,
          nonce: 0,
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
            txHash: "0xef1...",
            txIndex: 1,
            nonce: 0,
            amount: 400,
          },
          sourceChainID: "sourceChainID1",
          destinationChainID: "chainID1",
        },
      ],
      batchExecutedClaims: [],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
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
            nonce: 0,
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
                nonce: 0,
                amount: 201,
              },
            ],
            feePayerOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 2,
                nonce: 0,
                amount: 51,
              },
            ],
          },
        },
      ],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
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
                nonce: 0,
                amount: 201,
              },
            ],
            feePayerOwnedUTXOs: [
              {
                txHash: "0xdef...",
                txIndex: 2,
                nonce: 0,
                amount: 51,
              },
            ],
          },
        },
      ],
      batchExecutionFailedClaims: [],
      refundRequestClaims: [],
      refundExecutedClaims: [],
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
            nonce: 0,
            amount: 200,
          },
          rawTransaction: "rawTransaction1",
          multisigSignature: "multisigSignature1",
          retryCounter: 1,
        },
      ],
      refundExecutedClaims: [],
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
            nonce: 0,
            amount: 200,
          },
          rawTransaction: "rawTransaction1",
          multisigSignature: "multisigSignature1",
          retryCounter: 1,
        },
      ],
      refundExecutedClaims: [],
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
            nonce: 0,
            amount: 200,
          },
        },
      ],
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
            nonce: 0,
            amount: 200,
          },
        },
      ],
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
            nonce: 0,
            amount: 200,
          },
        },
      ],
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
            nonce: 0,
            amount: 200,
          },
          {
            txHash: "0xdef...",
            txIndex: 2,
            nonce: 0,
            amount: 100,
          },
        ],
        feePayerOwnedUTXOs: [
          {
            txHash: "0xdef...",
            txIndex: 1,
            nonce: 0,
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
      signedBatchManager,
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
    it("Should set 5 validator with quorum of 4", async function () {
      const { bridgeContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await bridgeContract.getQuorumNumberOfValidators();

      expect(numberOfValidators).to.equal(4);
    });

    describe("Registering new chain with Owner", function () {
      it("Should reject new chain if not set by owner", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(validators[0]).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        ).to.be.revertedWithCustomError(bridgeContract, "NotOwner");
      });

      it("Should add new chain if requested by owner", async function () {
        const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;
      });

      it("Should store UTXOs when new chain is registered by owner", async function () {
        const { bridgeContract, uTXOsManager, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
          UTXOs.multisigOwnedUTXOs[0].txHash
        );
        expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
          UTXOs.feePayerOwnedUTXOs[0].txHash
        );
      });

      it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
        const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.nextTimeoutBlock("chainID1")).to.equal(
          (await ethers.provider.getBlockNumber()) + 5
        );
      });

      it("Should emit new chain registered when registered by owner", async function () {
        const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await expect(bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100))
          .to.emit(bridgeContract, "newChainRegistered")
          .withArgs("chainID1");
      });
    });

    describe("Registering new chain with Governance", function () {
      it("Should reject proposal if chain is already registered with Governance", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;

        await expect(
          bridgeContract
            .connect(validators[4])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainAlreadyRegistered");
      });

      it("Should reject proposal if not sent by validator", async function () {
        const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(owner).registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        ).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
      });

      it("Should revert if same validator votes twice for the same chain", async function () {
        const { bridgeContract, claimsHelper, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await expect(
          bridgeContract
            .connect(validators[0])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should emit new chain proposal", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract
            .connect(validators[0])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        )
          .to.emit(bridgeContract, "newChainProposal")
          .withArgs("chainID1", validators[0].address);
      });

      it("Should not add new chain if there is no 100% quorum", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;
      });

      it("Should add new chain if there are enough votes (100% of them)", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.isChainRegistered("chainID1")).to.be.true;
      });

      it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect(await bridgeContract.nextTimeoutBlock("chainID1")).to.equal(
          (await ethers.provider.getBlockNumber()) + 5
        );
      });

      it("Should store UTXOs when new chain is registered with Governance", async function () {
        const { bridgeContract, uTXOsManager, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
          UTXOs.multisigOwnedUTXOs[0].txHash
        );
        expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
          UTXOs.feePayerOwnedUTXOs[0].txHash
        );
      });

      it("Should emit new chain registered when registered by Governance", async function () {
        const { bridgeContract, validators, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await expect(
          bridgeContract
            .connect(validators[4])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100)
        )
          .to.emit(bridgeContract, "newChainRegistered")
          .withArgs("chainID1");
      });

      it("Should list all registered chains", async function () {
        const { bridgeContract, UTXOs, validators } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Bridging Request Claim if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1
          );

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
        ).to.be.revertedWithCustomError(claimsHelper, "NotEnoughBridgingTokensAwailable");
      });

      it("Should remove requred amount of tokens from source chain when Bridging Request Claim is confirmed", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1000
          );

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
      it("Should revert if same validator submits the same Batch Executed Claim twice", async function () {
        const { bridgeContract, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Batch Executed Claim if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, signedBatch, validatorClaimsBEC } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            1000
          );

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

        expect(await claimsManager.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(
          1100
        );
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
        const { bridgeContract, signedBatchManager, validators, validatorClaimsBEFC } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

        expect(
          await signedBatchManager.currentBatchBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)
        ).to.equal(-1);
        expect(
          await bridgeContract.nextTimeoutBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)
        ).to.equal(26);
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
    describe("Submit new Last Observed Block Info", function () {
      it("Should revert if same validator submits the same Last Observed Block Info twice", async function () {
        const { bridgeContract, claimsHelper, validators, validatorClaimsRRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should revert if Last Observed Block Info is already confirmed", async function () {
        const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);
        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
      });
    });
    describe("Batch creation", function () {
      it("ShouldCreateBatch should return false if there is not enough validated claims and no pending signedClaims from validator", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

        expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID))
          .to.be.false;
      });

      it("ShouldCreateBatch should return true if there is enough validated claims and no pending batches", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID))
          .to.be.true;
      });

      it("ShouldCreateBatch should return false if there is not enough validated claims and no timeout and no pending batch", async function () {
        const { bridgeContract, validators, owner, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

        expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID))
          .to.be.false;
      });

      it("ShouldCreateBatch should return true if there is not enough validated claims but did timeout and no pending signedClaims from validator", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        //no destinatin chain registered, so currentBatchBlock for that chain is 0

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");

        expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID))
          .to.be.false;
      });

      it("ShouldCreateBatch should return true if there is timeout and no pending batch", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

        //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");

        expect(await bridgeContract.shouldCreateBatch(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID))
          .to.be.true;
      });

      it("SignedBatch should be added to signedBatches if there is enough votes", async function () {
        const { bridgeContract, signedBatchManager, validators, signedBatch } = await loadFixture(
          deployBridgeContractFixture
        );
        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        expect(
          (
            await signedBatchManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).id
        ).to.equal(signedBatch.id);

        expect(
          (
            await signedBatchManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).rawTransaction
        ).to.equal(signedBatch.rawTransaction);

        expect(
          (
            await signedBatchManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).multisigSignature
        ).to.equal(signedBatch.multisigSignature);

        expect(
          (
            await signedBatchManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).feePayerMultisigSignature
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
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            "0xbcd",
            "0xbcd",
            10000
          );

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
      it("Should return required all utxos", async function () {
        const { bridgeContract, owner, UTXOs } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        const utxos = await bridgeContract.getAvailableUTXOs("chainID1");

        expect(utxos.multisigOwnedUTXOs.length).to.equal(UTXOs.multisigOwnedUTXOs.length);
        expect(utxos.feePayerOwnedUTXOs.length).to.equal(UTXOs.feePayerOwnedUTXOs.length);
        for (let i = 0; i < UTXOs.multisigOwnedUTXOs.length; i++) {
          expect(utxos.multisigOwnedUTXOs[i].nonce).to.equal(i + 1);
          expect(utxos.multisigOwnedUTXOs[i].amount).to.equal(UTXOs.multisigOwnedUTXOs[i].amount);
          expect(utxos.multisigOwnedUTXOs[i].txHash).to.equal(UTXOs.multisigOwnedUTXOs[i].txHash);
          expect(utxos.multisigOwnedUTXOs[i].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[i].txIndex);
        }
        for (let i = 0; i < UTXOs.feePayerOwnedUTXOs.length; i++) {
          expect(utxos.feePayerOwnedUTXOs[i].nonce).to.equal(i + UTXOs.multisigOwnedUTXOs.length + 1);
          expect(utxos.feePayerOwnedUTXOs[i].amount).to.equal(UTXOs.feePayerOwnedUTXOs[i].amount);
          expect(utxos.feePayerOwnedUTXOs[i].txHash).to.equal(UTXOs.feePayerOwnedUTXOs[i].txHash);
          expect(utxos.feePayerOwnedUTXOs[i].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[i].txIndex);
        }
      });

      it("Should remove used UTXOs and add out new UTXOs when Bridge Execution Claim is confirmed", async function () {
       const { bridgeContract, uTXOsManager, owner, validators, UTXOs, signedBatch, validatorClaimsBEC } =
        await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", "0xbcd", "0xbcd", 100);

        const initialResult = await uTXOsManager.getChainUTXOs("chainID1");
        expect(initialResult.multisigOwnedUTXOs.length).to.equal(UTXOs.multisigOwnedUTXOs.length);
        expect(initialResult.feePayerOwnedUTXOs.length).to.equal(UTXOs.feePayerOwnedUTXOs.length);

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

        const result = await uTXOsManager.getChainUTXOs("chainID1");

        expect(result.multisigOwnedUTXOs.length).to.equal(2);
        expect(result.multisigOwnedUTXOs[0].nonce).to.equal(2);
        expect(result.multisigOwnedUTXOs[0].txHash).to.equal(UTXOs.multisigOwnedUTXOs[1].txHash);
        expect(result.multisigOwnedUTXOs[0].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[1].txIndex);
        expect(result.multisigOwnedUTXOs[1].nonce).to.equal(7);
        expect(result.multisigOwnedUTXOs[1].txHash).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.multisigOwnedUTXOs[0].txHash);
        expect(result.multisigOwnedUTXOs[1].txIndex).to.equal(
            validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.multisigOwnedUTXOs[0].txIndex);

        expect(result.feePayerOwnedUTXOs.length).to.equal(3);
        expect(result.feePayerOwnedUTXOs[0].nonce).to.equal(4);
        expect(result.feePayerOwnedUTXOs[0].txHash).to.equal(UTXOs.feePayerOwnedUTXOs[0].txHash);
        expect(result.feePayerOwnedUTXOs[0].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[0].txIndex);
        expect(result.feePayerOwnedUTXOs[1].nonce).to.equal(6);
        expect(result.feePayerOwnedUTXOs[1].txHash).to.equal(UTXOs.feePayerOwnedUTXOs[2].txHash);
        expect(result.feePayerOwnedUTXOs[1].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[2].txIndex);
        expect(result.feePayerOwnedUTXOs[2].nonce).to.equal(8);
        expect(result.feePayerOwnedUTXOs[2].txHash).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.feePayerOwnedUTXOs[0].txHash);
          expect(result.feePayerOwnedUTXOs[2].txIndex).to.equal(
            validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.feePayerOwnedUTXOs[0].txIndex);
      });
    });
  });
});
