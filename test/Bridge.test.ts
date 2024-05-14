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
  async function deployBridgeFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5, validator6] = await ethers.getSigners();
    const validators = [validator1, validator2, validator3, validator4, validator5];

    const hre = require("hardhat");

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridgeLogic = await Bridge.deploy();

    const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelperLogic = await ClaimsHelper.deploy();

    const Claims = await ethers.getContractFactory("Claims");
    const claimsLogic = await Claims.deploy();

    const SignedBatches = await ethers.getContractFactory("SignedBatches");
    const signedBatchesLogic = await SignedBatches.deploy();

    const Slots = await ethers.getContractFactory("Slots");
    const slotsLogic = await Slots.deploy();

    const UTXOsc = await ethers.getContractFactory("UTXOsc");
    const utxoscLogic = await UTXOsc.deploy();

    const Validators = await ethers.getContractFactory("Validators");
    const validatorscLogic = await Validators.deploy();

    // deployment of contract proxy
    const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const UTXOscProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");

    const bridgeProxy = await BridgeProxy.deploy(
      await bridgeLogic.getAddress(),
      Bridge.interface.encodeFunctionData("initialize", [])
    );

    const claimsHelperProxy = await ClaimsHelperProxy.deploy(
      await claimsHelperLogic.getAddress(),
      ClaimsHelper.interface.encodeFunctionData("initialize", [])
    );

    const claimsProxy = await ClaimsProxy.deploy(
      await claimsLogic.getAddress(),
      Claims.interface.encodeFunctionData("initialize", [2, 5])
    );

    const signedBatchesProxy = await SignedBatchesProxy.deploy(
      await signedBatchesLogic.getAddress(),
      SignedBatches.interface.encodeFunctionData("initialize", [])
    );

    const slotsProxy = await SlotsProxy.deploy(
      await slotsLogic.getAddress(),
      Slots.interface.encodeFunctionData("initialize", [])
    );

    const utxoscProxy = await UTXOscProxy.deploy(
      await utxoscLogic.getAddress(),
      UTXOsc.interface.encodeFunctionData("initialize", [])
    );

    const validatorsAddresses = [
      validator1.address,
      validator2.address,
      validator3.address,
      validator4.address,
      validator5.address,
    ];

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [validatorsAddresses])
    );

    //casting proxy contracts to contract logic
    const BridgeDeployed = await ethers.getContractFactory("Bridge");
    const bridge = BridgeDeployed.attach(bridgeProxy.target);

    const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
    const claimsHelper = ClaimsHelperDeployed.attach(claimsHelperProxy.target);

    const ClaimsDeployed = await ethers.getContractFactory("Claims");
    const claims = ClaimsDeployed.attach(claimsProxy.target);

    const SignedBatchesDeployed = await ethers.getContractFactory("SignedBatches");
    const signedBatches = SignedBatchesDeployed.attach(signedBatchesProxy.target);

    const SlotsDeployed = await ethers.getContractFactory("Slots");
    const slots = SlotsDeployed.attach(slotsProxy.target);

    const UTXOscDeployed = await ethers.getContractFactory("UTXOsc");
    const utxosc = UTXOscDeployed.attach(utxoscProxy.target);

    const ValidatorsDeployed = await ethers.getContractFactory("Validators");
    const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target);

    await bridge.setDependencies(
      claimsProxy.target,
      signedBatchesProxy.target,
      slotsProxy.target,
      utxoscProxy.target,
      validatorsProxy.target
    );

    await claimsHelper.setDependencies(claims.target, signedBatches.target);

    await claims.setDependencies(bridge.target, claimsHelper.target, utxosc.target, validatorsc.target);

    await signedBatches.setDependencies(bridge.target, claimsHelper.target, validatorsc);

    await slots.setDependencies(bridge.target, validatorsc.target);

    await utxosc.setDependencies(bridge.target, claims.target);

    await validatorsc.setDependencies(bridge.target);

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
      firstTxNonceId: 1,
      lastTxNonceId: 1,
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
      bridge,
      claimsHelper,
      claims,
      utxosc,
      signedBatches,
      owner,
      UTXOs,
      validatorsc,
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
      validators,
    };
  }

  describe("Deployment", function () {
    it("Should set 5 validator with quorum of 4", async function () {
      const { validatorsc } = await loadFixture(deployBridgeFixture);
      const numberOfValidators = await validatorsc.getQuorumNumberOfValidators();

      expect(numberOfValidators).to.equal(4);
    });
  });

  describe("Registering new chain with Owner", function () {
    it("Should reject new chain if not set by owner", async function () {
      const { bridge, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(validators[0]).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100)
      ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
    });

    it("Should add new chain if requested by owner", async function () {
      const { bridge, claims, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.true;
    });

    it("Should store UTXOs when new chain is registered by owner", async function () {
      const { bridge, utxosc, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      expect((await utxosc.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
        UTXOs.multisigOwnedUTXOs[0].txHash
      );
      expect((await utxosc.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
        UTXOs.feePayerOwnedUTXOs[0].txHash
      );
    });

    it("Should set correct nextTimeoutBlock when chain is registered by owner", async function () {
      const { bridge, claims, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      expect(await claims.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
    });

    it("Should emit new chain registered when registered by owner", async function () {
      const { bridge, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100))
        .to.emit(bridge, "newChainRegistered")
        .withArgs("chainID1");
    });
  });

  describe("Registering new chain with Governance", function () {
    it("Should reject proposal if chain is already registered with Governance", async function () {
      const { bridge, claims, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.false;

      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.true;

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100)
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should reject proposal if not sent by validator", async function () {
      const { bridge, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridge, claimsHelper, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should emit new chain proposal", async function () {
      const { bridge, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge
          .connect(validators[0])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100)
      )
        .to.emit(bridge, "newChainProposal")
        .withArgs("chainID1", validators[0].address);
    });

    it("Should not add new chain if there is no 100% quorum", async function () {
      const { bridge, claims, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.false;
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      const { bridge, claims, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.false;

      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.false;

      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      expect(await claims.isChainRegistered("chainID1")).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridge, claims, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      expect(await claims.nextTimeoutBlock("chainID1")).to.equal((await ethers.provider.getBlockNumber()) + 5);
    });

    it("Should store UTXOs when new chain is registered with Governance", async function () {
      const { bridge, utxosc, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      expect((await utxosc.getChainUTXOs("chainID1")).multisigOwnedUTXOs[0].txHash).to.equal(
        UTXOs.multisigOwnedUTXOs[0].txHash
      );
      expect((await utxosc.getChainUTXOs("chainID1")).feePayerOwnedUTXOs[0].txHash).to.equal(
        UTXOs.feePayerOwnedUTXOs[0].txHash
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridge, validators, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);

      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);

      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);

      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);

      await expect(
        bridge
          .connect(validators[4])
          .registerChainGovernance("chainID1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100)
      )
        .to.emit(bridge, "newChainRegistered")
        .withArgs("chainID1");
    });

    it("Should list all registered chains", async function () {
      const { bridge, UTXOs, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1 1", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      await bridge
        .connect(validators[0])
        .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[0].data, 100);
      await bridge
        .connect(validators[1])
        .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[1].data, 100);
      await bridge
        .connect(validators[2])
        .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[2].data, 100);
      await bridge
        .connect(validators[3])
        .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[3].data, 100);
      await bridge
        .connect(validators[4])
        .registerChainGovernance("chainID1 2", UTXOs, "0x", "0x", validatorsCardanoData[4].data, 100);

      const chains = await bridge.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal("chainID1 1");
      expect(chains[1].id).to.equal("chainID1 2");

      const valids1 = await bridge.getValidatorsCardanoData("chainID1 1");
      const valids2 = await bridge.getValidatorsCardanoData("chainID1 2");
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
      const { bridge, validatorsc, UTXOs, validatorsCardanoData, validators, hre, validator6 } = await loadFixture(
        deployBridgeFixture
      );

      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validatorsCardanoData[0].addr, validatorsCardanoData[0].data);
      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validatorsCardanoData[1].addr, validatorsCardanoData[1].data);
      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validatorsCardanoData[2].addr, validatorsCardanoData[2].data);
      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validatorsCardanoData[3].addr, validatorsCardanoData[3].data);

      const data = await validatorsc.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
      expect(data.length).to.equal(0);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validatorsCardanoData[4].addr, validatorsCardanoData[4].data);

      const data2 = await validatorsc.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
      expect(data2.length).to.equal(await validatorsc.validatorsCount());

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData("chainID1 1", validator6, validatorsCardanoData[4].data);

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
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

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      validatorsCardanoData.push({
        addr: validator6.address,
        data: {
          verifyingKey: "0x" + 5,
          verifyingKeyFee: "0x" + 5 + "a",
        },
      });

      await expect(
        validatorsc.connect(signer).setValidatorsCardanoData("chainID1 1", validatorsCardanoData)
      ).to.revertedWithCustomError(validatorsc, "InvalidData");

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData("chainID1 1");
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

  describe("Submit new Bridging Request Claim", function () {
    it("Should revert if either source and destination chains are not registered", async function () {
      const { bridge, owner, validators, UTXOs, validatorsCardanoData, validatorClaimsBRC } = await loadFixture(
        deployBridgeFixture
      );

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should reject any claim if not sent by validator", async function () {
      const { bridge, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);
    });

    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    });

    it("Should add new Bridging Request Claim if there are enough votes", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should skip Bridging Request Claim if there is not enough bridging tokens", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
    });

    it("Should remove requred amount of tokens from source chain when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID)).to.equal(900);
    });

    it("Should not add any UTXO to the source chain if Bridging Request Claim quorum is not reached", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      const sourceChainUtxos = await bridge
        .connect(validators[0])
        .getAvailableUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);
      expect(sourceChainUtxos.multisigOwnedUTXOs.length).to.equal(3);
    });

    it("Should add requred amount of UTXO to the source chain when Bridging Request Claim is confirmed", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const sourceChainUtxos = await bridge
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
      const { bridge, claims, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
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
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const nonce = Number(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      );
      const confirmedTx = await claims.getConfirmedTransaction(
        validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
        oldNonce
      );
      expect(confirmedTx.nonce).to.equal(oldNonce);
      expect(nonce).to.equal(Number(oldNonce) + 1);

      // for some reason there is no receivers field inside confirmedTx structure
    });

    it("Should add confirmed transaction to the map after Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
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
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const nonce = Number(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      );
      const confirmedTx = await claims.getConfirmedTransaction(
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
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await setCode("0x0000000000000000000000000000000000002050", "0x60206000F3"); // should return false for precompile
      await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "InvalidSignature"
      );
    });
    it("Should revert if chain is not registered", async function () {
      const { bridge, claimsHelper, validators, validatorClaimsBEC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEC)).to.be.revertedWithCustomError(
        claimsHelper,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if same validator submits the same Batch Executed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBEC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
    });

    it("Should add new Batch Executed Claim if there are enough votes", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEC.batchExecutedClaims[0].chainID,
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEC.batchExecutedClaims[0].chainID,
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should add requred amount of tokens from source chain when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claims.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(1100);
    });
    it("Should update NEXT_BATCH_TIMEOUT_BLOCK on transaction confirmation if there is no batch in progress, there are no other confirmed transactions, and the current block number is greater than the NEXT_BATCH_TIMEOUT_BLOCK", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(await claims.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainID)).to.equal(1100);
      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });
  });

  describe("Submit new Batch Execution Failed Claims", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsBEFC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Batch Execution Failed Claims is already confirmed", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);
    });

    it("Should skip if same validator submits the same Batch Execution Failed Claims twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
    });

    it("Should add new Batch Execution Failed Claims if there are enough votes", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });

    it("Should reset current batch block and next timeout batch block when Batch Execution Failed Claims if confirmed", async function () {
      const { bridge, claims, claimsHelper, owner, validators, UTXOs, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const nextBatchBlock = await claims.nextTimeoutBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(await claimsHelper.currentBatchBlock(validatorClaimsBEFC.batchExecutionFailedClaims[0].chainID)).to.equal(
        -1
      );
      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
    });
  });

  describe("Submit new Refund Request Claims", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsRRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Refund Request Claims is already confirmed", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);
    });

    it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    });

    it("Should add new Refund Request Claims if there are enough votes", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsRRC.refundRequestClaims[0].chainID,
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

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
      const { bridge, validators, validatorClaimsRRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsRRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Refund Executed Claim is already confirmed", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);
    });

    it("Should skip if same validator submits the same Refund Executed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
    });

    it("Should add new Refund Executed Claim if there are enough votes", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsREC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsREC.refundExecutedClaims[0].chainID,
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash
        )
      ).to.be.false;

      await bridge.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(
        await claimsHelper.isClaimConfirmed(
          validatorClaimsREC.refundExecutedClaims[0].chainID,
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash
        )
      ).to.be.true;
    });
  });
  describe("Submit new Last Observed Block Info", function () {
    it("Should skip if same validator submits the same Last Observed Block Info twice", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
    });

    it("Should skip if Last Observed Block Info is already confirmed", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);
    });
  });

  describe("Transaction Confirmation", function () {
    it("GetConfirmedTransaction should not return transaction that occured after the timeout", async function () {
      const {
        bridge,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        validatorClaimsBRC_ConfirmedTransactions,
        validatorsCardanoData,
        hre,
        claims,
      } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          Number(firstTimestampBlockNumber)
        );

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
      });

      // wait for next timeout
      for (let i = 0; i < 6; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC_ConfirmedTransactions);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC_ConfirmedTransactions.bridgingRequestClaims[0].destinationChainID);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      expect(confirmedTxs.length).to.equal(1);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainID).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(
        await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)
      );
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
    });

    it("GetConfirmedTransactions should not return more transaction than MAX_NUMBER_OF_TRANSACTIONS", async function () {
      const { bridge, owner, UTXOs, validators, validatorClaimsBRC, validatorsCardanoData, claims, hre } =
        await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
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

      // Impersonate as Bridge in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          Number(firstTimestampBlockNumber + 100)
        );

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [bridgeAddress],
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC3);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainID);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainID).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC2.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainID).to.equal(validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainID);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });

    it("GetConfirmedTransactions should return transactions with appropriate Observed Transaction Hashes", async function () {
      const { bridge, owner, UTXOs, validators, validatorClaimsBRC, validatorsCardanoData, claims, hre } =
        await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );
      await bridge
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

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeContratAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeContratAddress);

      await claims
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC3);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC3);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      const confirmedTxs = await bridge
        .connect(validators[0])
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainID);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainID).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC3.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainID).to.equal(validatorClaimsBRC3.bridgingRequestClaims[0].sourceChainID);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });
  });

  describe("Batch creation", function () {
    it("SignedBatch submition should be reverted if chain is not registered", async function () {
      const { bridge, validators, owner, validatorClaimsBRC, UTXOs, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

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
        firstTxNonceId: 1,
        lastTxNonceId: 1,
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
        bridge.connect(validators[0]).submitSignedBatch(signedBatch_UnregisteredChain)
      ).to.be.revertedWithCustomError(bridge, "CanNotCreateBatchYet"); // should create batch should return false for unregistered chain
    });

    it("SignedBatch submition should be reverted if batch nounce is not correct", async function () {
      const { bridge, owner, validators, UTXOs, validatorsCardanoData, validatorClaimsBRC } = await loadFixture(
        deployBridgeFixture
      );

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

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
        firstTxNonceId: 1,
        lastTxNonceId: 1,
        usedUTXOs: {
          multisigOwnedUTXOs: [],
          feePayerOwnedUTXOs: [],
        },
      };

      await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "WrongBatchNonce"
      );
    });

    it("getNextBatchId should return 0 if there are no confirmed claims", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to.equal(0);

      // wait for next timeout
      for (let i = 0; i < 10; i++) {
        await ethers.provider.send("evm_mine");
      }

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to.equal(0);
    });

    it("getNextBatchId should return correct id if there are enough confirmed claims", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
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

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC2);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC2);

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to.equal(1);
    });

    it("getNextBatchId should return correct id if there is timeout", async function () {
      const { bridge, owner, validators, UTXOs, validatorClaimsBRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          1000
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      // wait for timeout
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID)).to.equal(1);
    });

    it("SignedBatch should be added to signedBatches if there are enough votes", async function () {
      const { bridge, claimsHelper, owner, validators, UTXOs, signedBatch, validatorsCardanoData, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);
      expect(confBatch.usedUTXOs.feePayerOwnedUTXOs.length).to.equal(signedBatch.usedUTXOs.feePayerOwnedUTXOs.length);
      expect(confBatch.usedUTXOs.multisigOwnedUTXOs.length).to.equal(signedBatch.usedUTXOs.multisigOwnedUTXOs.length);

      for (let i = 0; i < confBatch.usedUTXOs.multisigOwnedUTXOs.length; i++) {
        expect(confBatch.usedUTXOs.multisigOwnedUTXOs[i].txHash).to.equal(
          signedBatch.usedUTXOs.multisigOwnedUTXOs[i].txHash
        );
        expect(confBatch.usedUTXOs.multisigOwnedUTXOs[i].txIndex).to.equal(
          signedBatch.usedUTXOs.multisigOwnedUTXOs[i].txIndex
        );
        expect(confBatch.usedUTXOs.multisigOwnedUTXOs[i].amount).to.equal(
          signedBatch.usedUTXOs.multisigOwnedUTXOs[i].amount
        );
      }

      for (let i = 0; i < confBatch.usedUTXOs.feePayerOwnedUTXOs.length; i++) {
        expect(confBatch.usedUTXOs.feePayerOwnedUTXOs[i].txHash).to.equal(
          signedBatch.usedUTXOs.feePayerOwnedUTXOs[i].txHash
        );
        expect(confBatch.usedUTXOs.feePayerOwnedUTXOs[i].txIndex).to.equal(
          signedBatch.usedUTXOs.feePayerOwnedUTXOs[i].txIndex
        );
        expect(confBatch.usedUTXOs.feePayerOwnedUTXOs[i].amount).to.equal(
          signedBatch.usedUTXOs.feePayerOwnedUTXOs[i].amount
        );
      }

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);
    });

    it("Should create ConfirmedBatch if there are enough votes", async function () {
      const { bridge, owner, validators, UTXOs, validatorsCardanoData, signedBatch, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).rawTransaction
      ).to.equal(signedBatch.rawTransaction);
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures
          .length
      ).to.equal(4);
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId))
          .feePayerMultisigSignatures.length
      ).to.equal(4);

      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[0]
      ).to.equal("multisigSignature1");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[1]
      ).to.equal("multisigSignature1");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[2]
      ).to.equal("multisigSignature1");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[3]
      ).to.equal("multisigSignature1");
    });

    it("Should create and execute batch after transactions are confirmed", async function () {
      const {
        bridge,
        owner,
        validators,
        UTXOs,
        validatorClaimsBRC,
        validatorsCardanoData,
        signedBatch,
        validatorClaimsBEC,
      } = await loadFixture(deployBridgeFixture);
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          10000
        );
      await bridge
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
        bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain)
      ).to.be.revertedWithCustomError(bridge, "CanNotCreateBatchYet");

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      //every await in this describe is one block, so we need to wait 2 blocks to timeout (current timeout is 5 blocks)
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      const confirmedTxs = await bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain);
      expect(confirmedTxs.length).to.equal(1);

      expect(await bridge.shouldCreateBatch(_destinationChain)).to.be.true;

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      await expect(
        bridge.connect(validators[0]).getConfirmedTransactions(_destinationChain)
      ).to.revertedWithCustomError(bridge, "CanNotCreateBatchYet");
    });

    it("Should return appropriate token amount for signed batch", async function () {
      const { bridge, owner, validators, UTXOs, signedBatch, validatorsCardanoData, validatorClaimsBRC, claims } =
        await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        );

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const tokenAmount = await claims.getTokenAmountFromSignedBatch(signedBatch.destinationChainId, signedBatch.id);

      let sumAmounts = 0;
      for (let i = 0; i < validatorClaimsBRC.bridgingRequestClaims[0].receivers.length; i++) {
        sumAmounts += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amount;
      }

      expect(tokenAmount).to.equal(sumAmounts);
    });
  });
  describe("UTXO management", function () {
    it("Should return required all utxos", async function () {
      const { bridge, owner, UTXOs, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain("chainID1", UTXOs, "0x", "0x", validatorsCardanoData, 100);

      const utxos = await bridge.getAvailableUTXOs("chainID1");

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
        bridge,
        utxosc,
        owner,
        validators,
        UTXOs,
        signedBatch,
        validatorClaimsBEC,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        ); // UTXO_Nonces[sourceChainID]: [1, 2, 3], [4, 5, 6]
      await bridge
        .connect(owner)
        .registerChain(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID,
          UTXOs,
          "0x",
          "0x",
          validatorsCardanoData,
          100
        ); // UTXO_Nonces[destinationChainID]: [7, 8, 9], [10, 11, 12]

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC); // UTXO_Nonces[sourceChainID] = [1, 2, 3, 13]

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      const initialResult = await utxosc.getChainUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);
      expect(initialResult.multisigOwnedUTXOs.length).to.equal(UTXOs.multisigOwnedUTXOs.length);
      expect(initialResult.feePayerOwnedUTXOs.length).to.equal(UTXOs.feePayerOwnedUTXOs.length);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC); // UTXO_Nonces[destinationChainID]: [8, 13, 14], [10, 12, 15]

      const result = await utxosc.getChainUTXOs(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainID);

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
