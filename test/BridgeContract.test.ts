import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contract", function () {
  beforeEach(async () => {
    // mock isSignatureValid precompile to always return true
    await setCode("0x0000000000000000000000000000000000002050", "0x600160005260206000F3");
  });

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
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5, validator6] = await ethers.getSigners();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const hre = require("hardhat");

    const BridgeContract = await ethers.getContractFactory("BridgeContract");
    const bridgeContract = await BridgeContract.deploy();

    const ValidatorsContract = await ethers.getContractFactory("ValidatorsContract");
    const validatorsContract = await ValidatorsContract.deploy(validators, bridgeContract.target);

    const SlotsManager = await ethers.getContractFactory("SlotsManager");
    const slotsManager = await SlotsManager.deploy(bridgeContract.target, validatorsContract.target);

    const SignedBatchManager = await ethers.getContractFactory("SignedBatchManager");
    const signedBatchManager = await SignedBatchManager.deploy(bridgeContract.target);

    const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelper = await ClaimsHelper.deploy(signedBatchManager.target);

    const ClaimsManager = await ethers.getContractFactory("ClaimsManager");
    const claimsManager = await ClaimsManager.deploy(
      bridgeContract.target,
      claimsHelper.target,
      validatorsContract.target,
      signedBatchManager.target,
      2,
      5
    );

    const UTXOsManager = await ethers.getContractFactory("UTXOsManager");
    const uTXOsManager = await UTXOsManager.deploy(bridgeContract.target, claimsManager.target);

    await bridgeContract.setValidatorsContract(validatorsContract.target);
    await bridgeContract.setSlotsManager(slotsManager.target);
    await bridgeContract.setSignedBatchManager(signedBatchManager.target);
    await bridgeContract.setClaimsManager(claimsManager.target);
    await bridgeContract.setUTXOsManager(uTXOsManager.target);

    //await claimsHelper.setSignedBatchManagerAddress(signedBatchManager.target);

    await uTXOsManager.setClaimsManagerAddress(claimsManager.target);

    // impersonate as an owner to set contract dependencies
    var signer = await impersonateAsContractAndMintFunds(owner.address);

    await signedBatchManager.connect(signer).setClaimsHelper(claimsHelper.target);
    await signedBatchManager.connect(signer).setClaimsManager(claimsManager.target);
    await claimsHelper.connect(signer).setClaimsManager(claimsManager.target);
    await claimsManager.connect(signer).setUTXOsManager(uTXOsManager.target);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [owner.address],
    });

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
    const validatorClaimsBRC_ConfirmedTransactions = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: "0xbcd...",
          receivers: [
            {
              destinationAddress: "0x234...",
              amount: 100,
            },
          ],
          outputUTXO: {
            txHash: "0xfed...",
            txIndex: 0,
            nonce: 1,
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
          observedTransactionHash: "0xbac...",
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
      id: 1,
      destinationChainId: "chainID1",
      rawTransaction: "rawTransaction1",
      multisigSignature: "multisigSignature1",
      feePayerMultisigSignature: "feePayerMultisigSignature1",
      includedTransactions: [1],
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
            amount: 50,
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

    const validatorsCardanoData = [];
    let ind = 0;
    for (let val of validators) {
      ind++;
      validatorsCardanoData.push({
        addr: val.address,
        data: {
          verifyingKey: "0x" + ind,
          verifyingKeyFee: "0x" + ind + "a",
        },
      });
    }

    return {
      hre,
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
      validatorClaimsBRC_ConfirmedTransactions,
      signedBatch,
      validatorsCardanoData,
      validatorsContract,
    };
  }

  describe("Deployment", function () {
    it("Should set 5 validator with quorum of 4", async function () {
      const { bridgeContract, validatorsContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await validatorsContract.getQuorumNumberOfValidators();

      expect(numberOfValidators).to.equal(4);
    });

    describe("Registering new chain with Owner", function () {
      it("Should reject new chain if not set by owner", async function () {
        const { bridgeContract, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await expect(
          bridgeContract.connect(validators[0]).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100)
        ).to.be.revertedWithCustomError(bridgeContract, "NotOwner");
      });

      it("Should add new chain if requested by owner", async function () {
        const { bridgeContract, claimsManager, owner, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.true;
      });

      it("Should store UTXOs when new chain is registered by owner", async function () {
        const { bridgeContract, uTXOsManager, owner, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
          UTXOs.multisigOwnedUTXOs[0].txHash
        );
        expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
          UTXOs.feePayerOwnedUTXOs[0].txHash
        );
      });

      it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
        const { bridgeContract, claimsManager, owner, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        expect(await claimsManager.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
      });

      it("Should emit new chain registered when registered by owner", async function () {
        const { bridgeContract, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100)
        )
          .to.emit(bridgeContract, "newChainRegistered")
          .withArgs("chainID1");
      });
    });

    describe("Registering new chain with Governance", function () {
      it("Should reject proposal if chain is already registered with Governance", async function () {
        const { bridgeContract, claimsManager, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.true;

        await expect(
          bridgeContract
            .connect(validators[4])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainAlreadyRegistered");
      });

      it("Should reject proposal if not sent by validator", async function () {
        const { bridgeContract, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract
            .connect(owner)
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
        ).to.be.revertedWithCustomError(bridgeContract, "NotValidator");
      });

      it("Should revert if same validator votes twice for the same chain", async function () {
        const { bridgeContract, claimsHelper, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);

        await expect(
          bridgeContract
            .connect(validators[0])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should emit new chain proposal", async function () {
        const { bridgeContract, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await expect(
          bridgeContract
            .connect(validators[0])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
        )
          .to.emit(bridgeContract, "newChainProposal")
          .withArgs("chainID1", validators[0].address);
      });

      it("Should not add new chain if there is no 100% quorum", async function () {
        const { bridgeContract, claimsManager, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.false;
      });

      it("Should add new chain if there are enough votes (100% of them)", async function () {
        const { bridgeContract, claimsManager, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.false;

        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        expect(await claimsManager.isChainRegistered("chainID1")).to.be.true;
      });

      it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
        const { bridgeContract, claimsManager, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        expect(await claimsManager.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
      });

      it("Should store UTXOs when new chain is registered with Governance", async function () {
        const { bridgeContract, uTXOsManager, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        expect((await uTXOsManager.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
          UTXOs.multisigOwnedUTXOs[0].txHash
        );
        expect((await uTXOsManager.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
          UTXOs.feePayerOwnedUTXOs[0].txHash
        );
      });

      it("Should emit new chain registered when registered by Governance", async function () {
        const { bridgeContract, validators, UTXOs, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);

        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);

        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

        await expect(
          bridgeContract
            .connect(validators[4])
            .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100)
        )
          .to.emit(bridgeContract, "newChainRegistered")
          .withArgs("chainID1");
      });

      it("Should list all registered chains", async function () {
        const { bridgeContract, UTXOs, validators, validatorsCardanoData } = await loadFixture(
          deployBridgeContractFixture
        );

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        await bridgeContract
          .connect(validators[0])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
        await bridgeContract
          .connect(validators[1])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
        await bridgeContract
          .connect(validators[2])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
        await bridgeContract
          .connect(validators[3])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
        await bridgeContract
          .connect(validators[4])
          .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

        const chains = await bridgeContract.getAllRegisteredChains();
        expect(chains.length).to.equal(2);
        expect(chains[0].id).to.equal("chainID1 1");
        expect(chains[1].id).to.equal("chainID1 2");

        const valids1 = await bridgeContract.getValidatorsCardanoData("chainID1 1");
        const valids2 = await bridgeContract.getValidatorsCardanoData("chainID1 2");
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
        const { bridgeContract, validators, UTXOs, validatorsCardanoData, validatorsContract, hre, validator6 } =
          await loadFixture(deployBridgeContractFixture);

        const bridgeContractAddress = await bridgeContract.getAddress();

        var signer = await impersonateAsContractAndMintFunds(bridgeContractAddress);

        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validatorsCardanoData[0].addr, validatorsCardanoData[0].data);
        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validatorsCardanoData[1].addr, validatorsCardanoData[1].data);
        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validatorsCardanoData[2].addr, validatorsCardanoData[2].data);
        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validatorsCardanoData[3].addr, validatorsCardanoData[3].data);

        const data = await validatorsContract.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
        expect(data.length).to.equal(0);

        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validatorsCardanoData[4].addr, validatorsCardanoData[4].data);

        const data2 = await validatorsContract.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
        expect(data2.length).to.equal(await validatorsContract.validatorsCount());

        await validatorsContract
          .connect(signer)
          .addValidatorCardanoData("chainID1 1", validator6, validatorsCardanoData[4].data);

        const data3 = await validatorsContract.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
        expect(data3.length).to.equal(await validatorsContract.validatorsCount());

        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [bridgeContractAddress],
        });
      });

      it("Should not update Validators Cardano Data until length of the list with the new data doesn't match the number of validators", async function () {
        const { bridgeContract, validators, UTXOs, validatorsCardanoData, validatorsContract, hre, validator6 } =
          await loadFixture(deployBridgeContractFixture);

        const bridgeContractAddress = await bridgeContract.getAddress();

        var signer = await impersonateAsContractAndMintFunds(bridgeContractAddress);

        validatorsCardanoData.push({
          addr: validator6.address,
          data: {
            verifyingKey: "0x" + 5,
            verifyingKeyFee: "0x" + 5 + "a",
          },
        });

        await expect(
          validatorsContract.connect(signer).setValidatorsCardanoData("chainID1 1", validatorsCardanoData)
        ).to.revertedWithCustomError(validatorsContract, "InvalidData");

        const data3 = await validatorsContract.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
        expect(validatorsCardanoData.length).to.be.greaterThan(validators.length);
        expect(data3.length).to.equal(0);

        validatorsCardanoData.pop();

        expect(validatorsCardanoData.length).to.equal(validators.length);

        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [bridgeContractAddress],
        });
      });
    });

    describe("Submit new Bridging Request Claim", function () {
      it("Should revert if either source and destination chains are not registered", async function () {
        const { bridgeContract, validators, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainIsNotRegistered");
      });

      it("Should reject any claim if not sent by validator", async function () {
        const { bridgeContract, owner, validatorClaimsBRC } = await loadFixture(deployBridgeContractFixture);

        await expect(bridgeContract.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
          bridgeContract,
          "NotValidator"
        );
      });

      it("Should revert if Bridging Request Claim is already confirmed", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
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
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Bridging Request Claim if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
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

      it("Should reject Bridging Request Claim if there is not enough bridging tokens", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1
          );

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC)
        ).to.be.revertedWithCustomError(claimsHelper, "NotEnoughBridgingTokensAwailable");
      });

      it("Should remove requred amount of tokens from source chain when Bridging Request Claim is confirmed", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
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

      it("Should not add any UTXO to the source chain if Bridging Request Claim quorum is not reached", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);

        const sourceChainUtxos = await bridgeContract
          .connect(validators[0])
          .getAvailableUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);
        expect(sourceChainUtxos.multisigOwnedUTXOs.length).to.equal(3);
      });

      it("Should add requred amount of UTXO to the source chain when Bridging Request Claim is confirmed", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        const sourceChainUtxos = await bridgeContract
          .connect(validators[0])
          .getAvailableUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID);
        expect(sourceChainUtxos.multisigOwnedUTXOs.length).to.equal(4);
        expect(sourceChainUtxos.multisigOwnedUTXOs[3].txHash).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].outputUTXO.txHash
        );
        expect(sourceChainUtxos.multisigOwnedUTXOs[3].txIndex).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].outputUTXO.txIndex
        );
        expect(sourceChainUtxos.multisigOwnedUTXOs[3].amount).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].outputUTXO.amount
        );
      });

      it("Should add confirmed transaction to the map after Bridging Request Claim is confirmed", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const oldNonce = Number(
          await claimsManager.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        const nonce = Number(
          await claimsManager.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        );
        const confirmedTx = await claimsManager.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          oldNonce
        );
        expect(confirmedTx.nonce).to.equal(oldNonce);
        expect(nonce).to.equal(Number(oldNonce) + 1);

        // for some reason there is no receivers field inside confirmedTx structure
      });

      it("Should add confirmed transaction to the map after Bridging Request Claim is confirmed", async function () {
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const oldNonce = Number(
          await claimsManager.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        const nonce = Number(
          await claimsManager.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        );
        const confirmedTx = await claimsManager.getConfirmedTransaction(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          oldNonce
        );
        expect(confirmedTx.nonce).to.equal(oldNonce);
        expect(nonce).to.equal(Number(oldNonce) + 1);

        // for some reason there is no receivers field inside confirmedTx structure
      });
    });
    describe("Submit new Batch Executed Claim", function () {
      it("Should revert if signature is not valid", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3"); // should return false for precompile
        await expect(
          bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch)
        ).to.be.revertedWithCustomError(bridgeContract, "InvalidSignature");
      });
      it("Should revert if chain is not registered", async function () {
        const { bridgeContract, claimsManager, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(
          deployBridgeContractFixture
        );

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC)
        ).to.be.revertedWithCustomError(claimsHelper, "ChainIsNotRegistered");
      });

      it("Should revert if same validator submits the same Batch Executed Claim twice", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBEC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Batch Executed Claim if there are enough votes", async function () {
        const {
          bridgeContract,
          claimsHelper,
          owner,
          validators,
          UTXOs,
          validatorClaimsBRC,
          signedBatch,
          validatorClaimsBEC,
          validatorsCardanoData,
        } = await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

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
          validatorsCardanoData,
        } = await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

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
      it("Should update NEXT_BATCH_TIMEOUT_BLOCK on transaction confirmation if there is no batch in progress, there are no other confirmed transactions, and the current block number is greater than the NEXT_BATCH_TIMEOUT_BLOCK", async function () {
        const {
          bridgeContract,
          claimsManager,
          signedBatchManager,
          owner,
          validators,
          UTXOs,
          validatorClaimsBRC,
          validatorClaimsBEC,
          signedBatch,
          validatorsCardanoData,
        } = await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID;

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

        const lastConfirmedTxNonce = await claimsManager.lastConfirmedTxNonce(_destinationChain);
        const lastBatchedTxNonce = await claimsManager.lastBatchedTxNonce(_destinationChain);
        const nextBatchBlock = await claimsManager.nextTimeoutBlock(_destinationChain);
        const currentBlock = await ethers.provider.getBlockNumber();

        expect(await claimsManager.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(
          1100
        );
        expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
        expect(await claimsManager.currentBatchBlock(_destinationChain)).to.equal(-1);
        expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
      });
    });
    describe("Submit new Batch Execution Failed Claims", function () {
      it("Should revert if chain is not registered", async function () {
        const { bridgeContract, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainIsNotRegistered");
      });

      it("Should revert if Batch Execution Failed Claims is already confirmed", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

        await expect(
          bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBEFC)
        ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
      });

      it("Should revert if same validator submits the same Batch Execution Failed Claims twice", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Batch Execution Failed Claims if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

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
        const { bridgeContract, claimsManager, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEFC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEFC);

        const nextBatchBlock = await claimsManager.nextTimeoutBlock(
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID
        );
        const currentBlock = await ethers.provider.getBlockNumber();

        expect(
          await claimsManager.currentBatchBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)
        ).to.equal(-1);
        expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      });
    });
    describe("Submit new Refund Request Claims", function () {
      it("Should revert if chain is not registered", async function () {
        const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainIsNotRegistered");
      });

      it("Should revert if Refund Request Claims is already confirmed", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
      });

      it("Should revert if same validator submits the same Refund Request Claims twice", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Refund Request Claims if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

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
    });
    describe("Submit new Refund Executed Claim", function () {
      it("Should revert if chain is not registered", async function () {
        const { bridgeContract, validators, validatorClaimsRRC } = await loadFixture(deployBridgeContractFixture);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "ChainIsNotRegistered");
      });

      it("Should revert if Refund Executed Claim is already confirmed", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
      });

      it("Should revert if same validator submits the same Refund Executed Claim twice", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsREC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsREC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should add new Refund Executed Claim if there are enough votes", async function () {
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsREC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

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
        const { bridgeContract, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
      });

      it("Should revert if Last Observed Block Info is already confirmed", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsRRC);

        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsRRC);

        await expect(
          bridgeContract.connect(validators[4]).submitClaims(validatorClaimsRRC)
        ).to.be.revertedWithCustomError(bridgeContract, "AlreadyConfirmed");
      });
    });
    describe("Transaction Confirmation", function () {
      it("GetConfirmedTransaction should not return transaction that occured after the timeout", async function () {
        const {
          bridgeContract,
          owner,
          validators,
          UTXOs,
          validatorClaimsBRC,
          validatorClaimsBRC_ConfirmedTransactions,
          validatorsCardanoData,
          hre,
          claimsManager,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

        // Impersonate as ClaimsManager in order to set Next Timeout Block value
        const bridgeContractAddress = await bridgeContract.getAddress();

        var signer = await impersonateAsContractAndMintFunds(bridgeContractAddress);

        await claimsManager
          .connect(signer)
          .setNextTimeoutBlock(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            Number(firstTimestampBlockNumber)
          );

        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [bridgeContractAddress],
        });

        // wait for next timeout
        for (let i = 0; i < 6; i++) {
          await ethers.provider.send("evm_mine");
        }

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);

        const confirmedTxs = await bridgeContract
          .connect(validators[0])
          .getConfirmedTransactions(
            validatorClaimsBRC_ConfirmedTransactions.bridgingRequestClaims[0].destinationChainID
          );

        const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
        const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

        expect(confirmedTxs.length).to.equal(1);
        expect(confirmedTxs[0].nonce).to.equal(1);
        expect(confirmedTxs[0].observedTransactionHash).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        );
        expect(confirmedTxs[0].sourceChainID).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID
        );
        expect(confirmedTxs[0].blockHeight).to.be.lessThan(
          await claimsManager.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        );
        expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
        expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      });

      it("GetConfirmedTransactions should not return more transaction than MAX_NUMBER_OF_TRANSACTIONS", async function () {
        const {
          bridgeContract,
          owner,
          UTXOs,
          validators,
          validatorClaimsBRC,
          validatorsCardanoData,
          claimsManager,
          hre,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

        // Impersonate as BridgeContract in order to set Next Timeout Block value
        const bridgeContractAddress = await bridgeContract.getAddress();

        var signer = await impersonateAsContractAndMintFunds(bridgeContractAddress);

        await claimsManager
          .connect(signer)
          .setNextTimeoutBlock(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            Number(firstTimestampBlockNumber + 100)
          );

        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [bridgeContractAddress],
        });

        const validatorClaimsBRC2 = {
          ...validatorClaimsBRC,
          bridgingRequestClaims: [
            {
              ...validatorClaimsBRC.bridgingRequestClaims[0],
              observedTransactionHash: "0x676732344",
            },
          ],
        };

        const validatorClaimsBRC3 = {
          ...validatorClaimsBRC,
          bridgingRequestClaims: [
            {
              ...validatorClaimsBRC.bridgingRequestClaims[0],
              observedTransactionHash: "0x782748343",
            },
          ],
        };

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC2);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC3);

        const confirmedTxs = await bridgeContract
          .connect(validators[0])
          .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainID);

        const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
        const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

        const blockNum = await claimsManager.nextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID
        );
        expect(confirmedTxs.length).to.equal(2);
        expect(confirmedTxs[0].nonce).to.equal(1);
        expect(confirmedTxs[0].observedTransactionHash).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        );
        expect(confirmedTxs[0].sourceChainID).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID
        );
        expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
        expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
        expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
        expect(confirmedTxs[1].nonce).to.equal(2);
        expect(confirmedTxs[1].observedTransactionHash).to.equal(
          validatorClaimsBRC2.bridgingRequestClaims[0].observedTransactionHash
        );
        expect(confirmedTxs[1].sourceChainID).to.equal(
          validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainID
        );
        expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
      });

      it("GetConfirmedTransactions should return transactions with appropriate Observed Transaction Hashes", async function () {
        const {
          bridgeContract,
          owner,
          UTXOs,
          validators,
          validatorClaimsBRC,
          validatorsCardanoData,
          claimsManager,
          hre,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

        // Impersonate as ClaimsManager in order to set Next Timeout Block value
        const bridgeContratAddress = await bridgeContract.getAddress();

        var signer = await impersonateAsContractAndMintFunds(bridgeContratAddress);

        await claimsManager
          .connect(signer)
          .setNextTimeoutBlock(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            Number(firstTimestampBlockNumber + 100)
          );

        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [bridgeContratAddress],
        });

        const validatorClaimsBRC2 = {
          ...validatorClaimsBRC,
          bridgingRequestClaims: [
            {
              ...validatorClaimsBRC.bridgingRequestClaims[0],
              observedTransactionHash: "0x676732344",
            },
          ],
        };

        const validatorClaimsBRC3 = {
          ...validatorClaimsBRC,
          bridgingRequestClaims: [
            {
              ...validatorClaimsBRC.bridgingRequestClaims[0],
              observedTransactionHash: "0x782748343",
            },
          ],
        };

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC3);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC3);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC2);

        const confirmedTxs = await bridgeContract
          .connect(validators[0])
          .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainID);

        const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
        const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

        const blockNum = await claimsManager.nextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID
        );
        expect(confirmedTxs.length).to.equal(2);
        expect(confirmedTxs[0].nonce).to.equal(1);
        expect(confirmedTxs[0].observedTransactionHash).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        );
        expect(confirmedTxs[0].sourceChainID).to.equal(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID
        );
        expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
        expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
        expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
        expect(confirmedTxs[1].nonce).to.equal(2);
        expect(confirmedTxs[1].observedTransactionHash).to.equal(
          validatorClaimsBRC3.bridgingRequestClaims[0].observedTransactionHash
        );
        expect(confirmedTxs[1].sourceChainID).to.equal(
          validatorClaimsBRC3.bridgingRequestClaims[0].sourceChainID
        );
        expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
      });
    });

    describe("Batch creation", function () {
      it("SignedBatch submition should be reverted if chain is not registered", async function () {
        const { bridgeContract, validators, owner, validatorClaimsBRC, UTXOs, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        const signedBatch_UnregisteredChain = {
          id: 1,
          destinationChainId: "unregisteredChainID1",
          rawTransaction: "rawTransaction1",
          multisigSignature: "multisigSignature1",
          feePayerMultisigSignature: "feePayerMultisigSignature1",
          includedTransactions: [1],
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
                amount: 50,
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

        await expect(
          bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch_UnregisteredChain)
        ).to.be.revertedWithCustomError(bridgeContract, "CanNotCreateBatchYet"); // should create batch should return false for unregistered chain
      });

      it("SignedBatch submition should be reverted if batch nounce is not correct", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorsCardanoData, validatorClaimsBRC } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        const signedBatch = {
          id: 2,
          destinationChainId: "chainID1",
          rawTransaction: "rawTransaction1",
          multisigSignature: "multisigSignature1",
          feePayerMultisigSignature: "feePayerMultisigSignature1",
          includedTransactions: [1],
          usedUTXOs: {
            multisigOwnedUTXOs: [],
            feePayerOwnedUTXOs: [],
          },
        };

        await expect(
          bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch)
        ).to.be.revertedWithCustomError(bridgeContract, "WrongBatchNonce");
      });

      it("getNextBatchId should return 0 if there are no confirmed claims", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);

        expect(
          await bridgeContract.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        ).to.equal(0);

        // wait for next timeout
        for (let i = 0; i < 10; i++) {
          await ethers.provider.send("evm_mine");
        }

        expect(
          await bridgeContract.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        ).to.equal(0);
      });

      it("getNextBatchId should return correct id if there are enough confirmed claims", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        const validatorClaimsBRC2 = {
          ...validatorClaimsBRC,
          bridgingRequestClaims: [
            {
              ...validatorClaimsBRC.bridgingRequestClaims[0],
              observedTransactionHash: "0x676732344",
            },
          ],
        };

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC2);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC2);

        expect(
          await bridgeContract.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        ).to.equal(1);
      });

      it("getNextBatchId should return correct id if there is timeout", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
          await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            1000
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        // wait for timeout
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");

        expect(
          await bridgeContract.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
        ).to.equal(1);
      });

      it("SignedBatch should be added to signedBatches if there are enough votes", async function () {
        const {
          bridgeContract,
          signedBatchManager,
          claimsManager,
          owner,
          validators,
          UTXOs,
          signedBatch,
          validatorsCardanoData,
          validatorClaimsBRC,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        expect(
          (
            await claimsManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).id
        ).to.equal(signedBatch.id);

        expect(
          (
            await claimsManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).rawTransaction
        ).to.equal(signedBatch.rawTransaction);

        expect(
          (
            await claimsManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).multisigSignature
        ).to.equal(signedBatch.multisigSignature);

        expect(
          (
            await claimsManager
              .connect(validators[0])
              .confirmedSignedBatches(signedBatch.destinationChainId, signedBatch.id)
          ).feePayerMultisigSignature
        ).to.equal(signedBatch.feePayerMultisigSignature);
      });

      it("Should create ConfirmedBatch if there are enough votes", async function () {
        const { bridgeContract, owner, validators, UTXOs, validatorsCardanoData, signedBatch, validatorClaimsBRC } =
          await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

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

      it("Should create and execute batch after transactions are confirmed", async function () {
        const {
          bridgeContract,
          owner,
          validators,
          UTXOs,
          validatorClaimsBRC,
          validatorsCardanoData,
          signedBatchManager,
          signedBatch,
          validatorClaimsBEC,
        } = await loadFixture(deployBridgeContractFixture);
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            10000
          );

        const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID;

        await expect(
          bridgeContract.connect(validators[0]).getConfirmedTransactions(_destinationChain)
        ).to.be.revertedWithCustomError(bridgeContract, "CanNotCreateBatchYet");

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBRC);

        //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");

        const confirmedTxs = await bridgeContract.connect(validators[0]).getConfirmedTransactions(_destinationChain);
        expect(confirmedTxs.length).to.equal(1);

        expect(await bridgeContract.shouldCreateBatch(_destinationChain)).to.be.true;

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC);

        await expect(
          bridgeContract.connect(validators[0]).getConfirmedTransactions(_destinationChain)
        ).to.revertedWithCustomError(bridgeContract, "CanNotCreateBatchYet");
      });

      it("Should return appropriate token amount for signed batch", async function () {
        const {
          bridgeContract,
          owner,
          validators,
          UTXOs,
          signedBatch,
          validatorsCardanoData,
          validatorClaimsBRC,
          claimsManager,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          );

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC);

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        const tokenAmount = await claimsManager.getTokenAmountFromSignedBatch(
          signedBatch.destinationChainId,
          signedBatch.id
        );

        let sumAmounts = 0;
        for (let i = 0; i < validatorClaimsBRC.bridgingRequestClaims[0].receivers.length; i++) {
          sumAmounts += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amount;
        }

        expect(tokenAmount).to.equal(sumAmounts);
      });
    });
    describe("UTXO management", function () {
      it("Should return required all utxos", async function () {
        const { bridgeContract, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

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

      it("Should remove used UTXOs and add out new UTXOs when Batch Executed Claim is confirmed", async function () {
        const {
          bridgeContract,
          uTXOsManager,
          owner,
          validators,
          UTXOs,
          signedBatch,
          validatorClaimsBEC,
          validatorsCardanoData,
          validatorClaimsBRC,
        } = await loadFixture(deployBridgeContractFixture);

        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          ); // UTXO_Nonces[sourceChainID]: [1, 2, 3], [4, 5, 6]
        await bridgeContract
          .connect(owner)
          .registerChain(
            validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
            UTXOs,
            "0x",
            "0x",
            validatorsCardanoData,
            100
          ); // UTXO_Nonces[destinationChainID]: [7, 8, 9], [10, 11, 12]

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBRC);
        await bridgeContract.connect(validators[4]).submitClaims(validatorClaimsBRC); // UTXO_Nonces[sourceChainID] = [1, 2, 3, 13]

        // wait for next timeout
        for (let i = 0; i < 3; i++) {
          await ethers.provider.send("evm_mine");
        }

        const initialResult = await uTXOsManager.getChainUTXOs(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID
        );
        expect(initialResult.multisigOwnedUTXOs.length).to.equal(UTXOs.multisigOwnedUTXOs.length);
        expect(initialResult.feePayerOwnedUTXOs.length).to.equal(UTXOs.feePayerOwnedUTXOs.length);

        await bridgeContract.connect(validators[0]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[1]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[2]).submitSignedBatch(signedBatch);
        await bridgeContract.connect(validators[3]).submitSignedBatch(signedBatch);

        await bridgeContract.connect(validators[0]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[1]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[2]).submitClaims(validatorClaimsBEC);
        await bridgeContract.connect(validators[3]).submitClaims(validatorClaimsBEC); // UTXO_Nonces[destinationChainID]: [8, 13, 14], [10, 12, 15]

        const result = await uTXOsManager.getChainUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);

        const { multiSig, feePayer } = {
          multiSig: [...result.multisigOwnedUTXOs],
          feePayer: [...result.feePayerOwnedUTXOs],
        };
        multiSig.sort(function (a, b) {
          return Number(a.nonce - b.nonce);
        });
        feePayer.sort(function (a, b) {
          return Number(a.nonce - b.nonce);
        });

        expect(multiSig.length).to.equal(2);
        expect(multiSig[0].nonce).to.equal(8);
        expect(multiSig[0].txHash).to.equal(UTXOs.multisigOwnedUTXOs[1].txHash);
        expect(multiSig[0].txIndex).to.equal(UTXOs.multisigOwnedUTXOs[1].txIndex);
        expect(multiSig[1].nonce).to.equal(14);
        expect(multiSig[1].txHash).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.multisigOwnedUTXOs[0].txHash
        );
        expect(multiSig[1].txIndex).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.multisigOwnedUTXOs[0].txIndex
        );

        expect(feePayer.length).to.equal(3);
        expect(feePayer[0].nonce).to.equal(10);
        expect(feePayer[0].txHash).to.equal(UTXOs.feePayerOwnedUTXOs[0].txHash);
        expect(feePayer[0].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[0].txIndex);
        expect(feePayer[1].nonce).to.equal(12);
        expect(feePayer[1].txHash).to.equal(UTXOs.feePayerOwnedUTXOs[2].txHash);
        expect(feePayer[1].txIndex).to.equal(UTXOs.feePayerOwnedUTXOs[2].txIndex);
        expect(feePayer[2].nonce).to.equal(15);
        expect(feePayer[2].txHash).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.feePayerOwnedUTXOs[0].txHash
        );
        expect(feePayer[2].txIndex).to.equal(
          validatorClaimsBEC.batchExecutedClaims[0].outputUTXOs.feePayerOwnedUTXOs[0].txIndex
        );
      });
    });
  });
});
