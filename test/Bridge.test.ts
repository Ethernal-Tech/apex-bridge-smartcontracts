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

    const Validators = await ethers.getContractFactory("Validators");
    const validatorscLogic = await Validators.deploy();

    // deployment of contract proxy
    const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
    const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
    const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
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

    const ValidatorsDeployed = await ethers.getContractFactory("Validators");
    const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target);

    await bridge.setDependencies(
      claimsProxy.target,
      signedBatchesProxy.target,
      slotsProxy.target,
      validatorsProxy.target
    );

    await claimsHelper.setDependencies(claims.target, signedBatches.target);

    await claims.setDependencies(bridge.target, claimsHelper.target, validatorsc.target);

    await signedBatches.setDependencies(bridge.target, claimsHelper.target, validatorsc);

    await slots.setDependencies(bridge.target, validatorsc.target);

    await validatorsc.setDependencies(bridge.target);

    const chain1 = {
      id: 1,
      addressMultisig: "addr_test1vqeux7xwusdju9dvsj8h7mca9aup2k439kfmwy773xxc2hcu7zy99",
      addressFeePayer: "addr_test1vrqaf07rkulldmr68nxktctsycs4wlj6urzlvpecwf37fmgc38xc6",
    };

    const chain2 = {
      id: 2,
      addressMultisig: "addr_test1vr8zy7jk35n9yyw4jg0r4z98eygmrqxvz5sch4dva9c8s2qjv2edc",
      addressFeePayer: "addr_test1vz8g63va7qat4ajyja4sndp06rv3penf3htqcwt6x4znyacfpea75",
    };

    const validatorCardanoData = {
      verifyingKey: "0x7465737600000000000000000000000000000000000000000000000000000000",
      verifyingKeyFee: "0x7465737600000000000000000000000000000000000000000000000000000002",
    };

    const validatorAddressCardanoData = [
      {
        addr: validator1.address,
        data: validatorCardanoData,
      },
      {
        addr: validator2.address,
        data: validatorCardanoData,
      },
      {
        addr: validator3.address,
        data: validatorCardanoData,
      },
      {
        addr: validator4.address,
        data: validatorCardanoData,
      },
      {
        addr: validator5.address,
        data: validatorCardanoData,
      },
    ];

    const batchProposerData = {
      multisigUTXOs: [
        {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 0,
        },
      ],
      feePayerUTXOs: [
        {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 2,
        },
      ],
      slot: 1,
    };

    const validatorClaimsBRC = {
      bridgingRequestClaims: [
        {
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          receivers: [
            {
              amount: 100,
              destinationAddress: "0x123...",
            },
          ],
          totalAmount: 100,
          sourceChainId: 1,
          destinationChainId: 2,
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          receivers: [
            {
              destinationAddress: "0x234...",
              amount: 100,
            },
          ],
          outputUTXO: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
            txIndex: 0,
            nonce: 1,
            amount: 200,
          },
          totalAmount: 100,
          sourceChainId: 1,
          destinationChainId: 2,
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          receivers: [
            {
              destinationAddress: "0x123...11111111",
              amount: 100,
            },
          ],
          outputUTXO: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
            txIndex: 0,
            nonce: 0,
            amount: 200,
          },
          sourceChainId: 1,
          destinationChainId: 2,
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
          observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          batchNonceId: 1,
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          batchNonceId: 1111111111,
          outputUTXOs: {
            multisigOwnedUTXOs: [
              {
                txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
                txIndex: 0,
                nonce: 0,
                amount: 201,
              },
            ],
            feePayerOwnedUTXOs: [
              {
                txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          batchNonceId: 1,
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          batchNonceId: 111111,
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
          multisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
          rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
          retryCounter: 1,
          chainId: 2,
          receiver: "receiver1",
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          receiver: "receiver1111111111",
          utxo: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
            txIndex: 0,
            nonce: 0,
            amount: 200,
          },
          rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
          multisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          refundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
          utxo: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          refundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
          utxo: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
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
          observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          chainId: 2,
          refundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
          utxo: {
            txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
            txIndex: 0,
            nonce: 0,
            amount: 200,
          },
        },
      ],
    };

    const signedBatch = {
      id: 1,
      destinationChainId: 2,
      rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
      multisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      feePayerMultisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
      firstTxNonceId: 1,
      lastTxNonceId: 1,
      proposerData: batchProposerData,
    };

    const cardanoBlocks = [
      {
        blockSlot: 1,
        blockHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
      },
      {
        blockSlot: 2,
        blockHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
      },
    ];

    const validatorsCardanoData = [];
    let ind = 0;
    for (let val of validators) {
      ind++;
      validatorsCardanoData.push({
        addr: val.address,
        data: {
          verifyingKey: "0x746573760000000000000000000000000000000000000000000000000000000" + ind,
          verifyingKeyFee: "0x74657376000000000000000000000000000000000000000000000000000000" + ind + "2",
        },
      });
    }

    return {
      hre,
      bridge,
      claimsHelper,
      claims,
      signedBatches,
      slots,
      owner,
      chain1,
      chain2,
      batchProposerData,
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
      cardanoBlocks,
      validatorAddressCardanoData,
    };
  }

  describe("Deployment", function () {
    it("Should set 5 validator with quorum of 4", async function () {
      const { validatorsc } = await loadFixture(deployBridgeFixture);
      const quorumNumberOfValidators = await validatorsc.getQuorumNumberOfValidators();

      expect(quorumNumberOfValidators).to.equal(4);
    });
  });

  describe("Performance", function () {
    it("registerChain", async function () {
      const { bridge, chain1, owner, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      const tx = await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });

    it("registerChainGovernance", async function () {
      const { bridge, chain1, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      const tx = await bridge
        .connect(validators[0])
        .registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });

    it("submitClaims BRC", async function () {
      const { bridge, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData, owner } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });

    it("submitSignedBatch", async function () {
      const { bridge, chain1, chain2, owner, validators, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      const tx = await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });

    it("submitClaims RRC", async function () {
      const { bridge, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });

    it("submitClaims REC", async function () {
      const { bridge, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const tx = await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      const receipt = await tx.wait();
      console.log("Gas spent: " + parseInt(receipt.gasUsed));
    });
  });

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
  });

  describe("Registering new chain with Governance", function () {
    it("Should revert proposal if chain is already registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;

      await expect(
        bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data)
      ).to.be.revertedWithCustomError(bridge, "ChainAlreadyRegistered");
    });

    it("Should revert proposal if not sent by validator", async function () {
      const { bridge, owner, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(owner).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(bridge, "NotValidator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridge, claimsHelper, validators, chain1, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      await expect(
        bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data)
      ).to.be.revertedWithCustomError(claimsHelper, "AlreadyProposed");
    });

    it("Should emit new chain proposal", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data))
        .to.emit(bridge, "newChainProposal")
        .withArgs(1, validators[0].address);
    });

    it("Should add new chain if there are enough votes (100% of them)", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.false;

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      expect(await claims.isChainRegistered(chain1.id)).to.be.true;
    });

    it("Should set correct nextTimeoutBlock when chain is registered with Governance", async function () {
      const { bridge, claims, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(BigInt(0));

      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      expect(await claims.nextTimeoutBlock(1)).to.equal(
        BigInt(await ethers.provider.getBlockNumber()) + (await claims.timeoutBlocksNumber())
      );
    });

    it("Should emit new chain registered when registered by Governance", async function () {
      const { bridge, validators, chain1, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);

      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);

      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);

      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);

      await expect(bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data))
        .to.emit(bridge, "newChainRegistered")
        .withArgs(1);
    });

    it("Should list all registered chains", async function () {
      const { bridge, chain1, chain2, validators, validatorsCardanoData } = await loadFixture(deployBridgeFixture);

      await bridge.connect(validators[0]).registerChainGovernance(chain1, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain1, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain1, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain1, 100, validatorsCardanoData[3].data);
      await bridge.connect(validators[4]).registerChainGovernance(chain1, 100, validatorsCardanoData[4].data);

      await bridge.connect(validators[0]).registerChainGovernance(chain2, 100, validatorsCardanoData[0].data);
      await bridge.connect(validators[1]).registerChainGovernance(chain2, 100, validatorsCardanoData[1].data);
      await bridge.connect(validators[2]).registerChainGovernance(chain2, 100, validatorsCardanoData[2].data);
      await bridge.connect(validators[3]).registerChainGovernance(chain2, 100, validatorsCardanoData[3].data);
      await bridge.connect(validators[4]).registerChainGovernance(chain2, 100, validatorsCardanoData[4].data);

      const chains = await bridge.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal(1);
      expect(chains[1].id).to.equal(2);

      const valids1 = await bridge.getValidatorsCardanoData(1);
      const valids2 = await bridge.getValidatorsCardanoData(2);
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
      const { bridge, validatorsc, validatorsCardanoData, validators, hre, validator6 } = await loadFixture(
        deployBridgeFixture
      );

      const bridgeAddress = await bridge.getAddress();

      const signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[0].addr, validatorsCardanoData[0].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[1].addr, validatorsCardanoData[1].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[2].addr, validatorsCardanoData[2].data);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[3].addr, validatorsCardanoData[3].data);

      const data = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);

      expect(data.length).to.equal(0);

      await validatorsc
        .connect(signer)
        .addValidatorCardanoData(1, validatorsCardanoData[4].addr, validatorsCardanoData[4].data);

      const data2 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
      expect(data2.length).to.equal(await validatorsc.validatorsCount());

      await validatorsc.connect(signer).addValidatorCardanoData(1, validator6, validatorsCardanoData[4].data);

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
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

      const signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      validatorsCardanoData.push({
        addr: validator6.address,
        data: {
          verifyingKey: "0x746573760000000000000000000000000000000000000000000000000000000" + 5,
          verifyingKeyFee: "0x74657376000000000000000000000000000000000000000000000000000000" + 5 + "2",
        },
      });

      await expect(
        validatorsc.connect(signer).setValidatorsCardanoData(1, validatorsCardanoData)
      ).to.revertedWithCustomError(validatorsc, "InvalidData");

      const data3 = await validatorsc.connect(validators[0]).getValidatorsCardanoData(1);
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
    it("Should revert claim submition in Claims SC if not called by bridge SC", async function () {
      const { bridge, claims, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).submitClaims(validatorClaimsBRC, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("Should revert if either source and destination chains are not registered", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, validatorClaimsBRC } = await loadFixture(
        deployBridgeFixture
      );

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should revert any claim if not sent by validator", async function () {
      const { bridge, owner, validatorClaimsBRC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitClaims(validatorClaimsBRC)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Claims SC setVoted should revert if not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claims
          .connect(owner)
          .setVoted(owner.address, "0x7465737400000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should skip if Bridging Request Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Bridging Request Claim twice", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should revert if Claims SC setTokenQuantity is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setTokenQuantity(1, 100)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC resetCurrentBatchBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setChainRegistered is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setChainRegistered(1)).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("Should revert if Claims SC setNextTimeoutBlock is not called by Bridge SC", async function () {
      const { bridge, claims, owner } = await loadFixture(deployBridgeFixture);

      await expect(claims.connect(owner).setNextTimeoutBlock(1, 100)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).resetCurrentBatchBlock(1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should revert if ClaimsHelper SC resetCurrentBatchBlock is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).setConfirmedSignedBatchData(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotSignedBatchesOrClaims"
      );
    });

    it("Should revert if ClaimsHelper SC setVotedOnlyIfNeeded is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper
          .connect(owner)
          .setVotedOnlyIfNeeded(owner.address, "0x7465737600000000000000000000000000000000000000000000000000000000", 1)
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatchesOrClaims");
    });

    it("Should revert if ClaimsHelper SC setVoted is not called by SignedBatches SC or Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper
          .connect(owner)
          .setVoted(owner.address, "0x7465737600000000000000000000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatchesOrClaims");
    });

    it("Should revert if ClaimsHelper SC setLastProposedBatchData is not called by SignedBatches SC", async function () {
      const { bridge, claimsHelper, owner, batchProposerData } = await loadFixture(deployBridgeFixture);

      await expect(
        claimsHelper.connect(owner).setLastProposedBatchData(1, batchProposerData)
      ).to.be.revertedWithCustomError(bridge, "NotSignedBatches");
    });

    it("Should revert if ClaimsHelper SC resetLastProposedBatchData is not called by Claims SC", async function () {
      const { bridge, claimsHelper, owner } = await loadFixture(deployBridgeFixture);

      await expect(claimsHelper.connect(owner).resetLastProposedBatchData(1)).to.be.revertedWithCustomError(
        bridge,
        "NotClaims"
      );
    });

    it("Should increase lastConfirmedTxNonce when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(0);

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(
        await claims.lastConfirmedTxNonce(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      ).to.equal(1);
    });

    it("Should store new confirmedTransactions when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      const destinationChainId = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;
      const nounce = await claims.lastConfirmedTxNonce(destinationChainId);

      expect((await claims.confirmedTransactions(destinationChainId, nounce)).observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect((await claims.confirmedTransactions(destinationChainId, nounce)).sourceChainId).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId
      );
      expect((await claims.confirmedTransactions(destinationChainId, nounce)).nonce).to.equal(nounce);
      expect((await claims.confirmedTransactions(destinationChainId, nounce)).totalAmount).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount
      );
      expect((await claims.confirmedTransactions(destinationChainId, nounce)).blockHeight).to.equal(
        await ethers.provider.getBlockNumber()
      );
    });

    it("Should set voted on Bridging Request Claim", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should update next timeout block when Bridging Request Claim is confirmed and requirements are met", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const currentBlock = await ethers.provider.getBlockNumber();

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        25
      );

      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(
        32
      );
    });

    it("Should skip Bridging Request Claim if there is not enough bridging tokens", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1, validatorsCardanoData);

      validatorClaimsBRC.bridgingRequestClaims[0].totalAmount = 1000000;

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "tuple(uint64, string)[]", "uint256", "uint8", "uint8"],
        [
          validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash,
          [
            [
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount,
              validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress,
            ],
          ],
          validatorClaimsBRC.bridgingRequestClaims[0].totalAmount,
          validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId,
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;

      validatorClaimsBRC.bridgingRequestClaims[0].totalAmount = 100;
    });

    it("Should remove requred amount of tokens from source chain when Bridging Request Claim is confirmed", async function () {
      const { bridge, claims, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(1000);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      expect(await claims.chainTokenQuantity(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId)).to.equal(900);
    });

    it("Should update nextTimeoutBlock when Bridging Request Claim is confirmed and conditions are met", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });
  });

  describe("Submit new Batch Executed Claim", function () {
    it("Should revert if signature is not valid", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, signedBatch, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

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
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should set voted on Bridging Executed Claim", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBEC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEC.batchExecutedClaims[0].observedTransactionHash,
          validatorClaimsBEC.batchExecutedClaims[0].batchNonceId,
          validatorClaimsBEC.batchExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should add requred amount of tokens from source chain when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

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

      expect(await claims.chainTokenQuantity(validatorClaimsBEC.batchExecutedClaims[0].chainId)).to.equal(1100);
    });

    it("Should update lastBatchedTxNonce when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        signedBatch,
        validatorClaimsBEC,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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

      const lastNonceBefore = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonceBefore).to.equal(0);

      // quorum reached!
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      const lastNonce = await claims.lastBatchedTxNonce(chain2.id);
      expect(lastNonce).to.equal(1);
    });

    it("Should reset currentBatchBlock when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should reset lastProposedBatchData when Bridging Excuted Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect((await claimsHelper.getBatcherProposedData(_destinationChain)).slot).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEC);

      expect((await claimsHelper.getBatcherProposedData(_destinationChain)).slot).to.equal(0);
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
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Batch Execution Failed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should set voted on Bridging Execution Failed Claim", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsBEFC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "uint64", "uint8"],
        [
          validatorClaimsBEFC.batchExecutionFailedClaims[0].observedTransactionHash,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].batchNonceId,
          validatorClaimsBEFC.batchExecutionFailedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should reset currentBatchBlock when Bridging Executed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.greaterThan(-1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect(await claimsHelper.currentBatchBlock(_destinationChain)).to.equal(-1);
    });

    it("Should update nextTimeoutBlock when Bridging Excuted Failed Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      const lastConfirmedTxNonce = await claims.lastConfirmedTxNonce(_destinationChain);
      const lastBatchedTxNonce = await claims.lastBatchedTxNonce(_destinationChain);
      const nextBatchBlock = await claims.nextTimeoutBlock(_destinationChain);
      const currentBlock = await ethers.provider.getBlockNumber();

      expect(nextBatchBlock).to.greaterThan(currentBlock + 1);
      expect(lastConfirmedTxNonce - lastBatchedTxNonce).to.be.lessThanOrEqual(1);
    });

    it("Should reset lastProposedBatchData when Bridging Excuted Claim is confirmed", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBEFC,
        signedBatch,
        validatorsCardanoData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[2]).submitSignedBatch(signedBatch);
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect((await claimsHelper.getBatcherProposedData(_destinationChain)).slot).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBEFC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBEFC);

      expect((await claimsHelper.getBatcherProposedData(_destinationChain)).slot).to.equal(0);
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
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
        [
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
          validatorClaimsRRC.refundRequestClaims[0].multisigSignature,
          validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].chainId,
          validatorClaimsRRC.refundRequestClaims[0].receiver,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Request Claims twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
        [
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
          validatorClaimsRRC.refundRequestClaims[0].multisigSignature,
          validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].chainId,
          validatorClaimsRRC.refundRequestClaims[0].receiver,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should set voted on Bridging Request Claim", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsRRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "bytes", "bytes", "uint64", "uint8", "string"],
        [
          validatorClaimsRRC.refundRequestClaims[0].observedTransactionHash,
          validatorClaimsRRC.refundRequestClaims[0].previousRefundTxHash,
          validatorClaimsRRC.refundRequestClaims[0].multisigSignature,
          validatorClaimsRRC.refundRequestClaims[0].rawTransaction,
          validatorClaimsRRC.refundRequestClaims[0].retryCounter,
          validatorClaimsRRC.refundRequestClaims[0].chainId,
          validatorClaimsRRC.refundRequestClaims[0].receiver,
        ]
      );

      const encoded20 = "0x0000000000000000000000000000000000000000000000000000000000000020" + encoded.substring(2);

      const hash = ethers.keccak256(encoded20);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsRRC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should TODO when  Refund Request Claims is confirmed", async function () {
      const { bridge, owner, validators, chain2, validatorClaimsRRC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsRRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsRRC);

      // TODO: check some data that is not changed after refund request claim consensus is not reached

      await bridge.connect(validators[3]).submitClaims(validatorClaimsRRC);

      // TODO: check some data that is changed after refund request claim consensus is reached
    });
  });

  describe("Submit new Refund Executed Claim", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, validatorClaimsREC } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(validators[0]).submitClaims(validatorClaimsREC)).to.be.revertedWithCustomError(
        bridge,
        "ChainIsNotRegistered"
      );
    });

    it("Should skip if Refund Executed Claim is already confirmed", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint8"],
        [
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash,
          validatorClaimsREC.refundExecutedClaims[0].refundTxHash,
          validatorClaimsREC.refundExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[4]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should skip if same validator submits the same Refund Executed Claim twice", async function () {
      const { bridge, claimsHelper, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint8"],
        [
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash,
          validatorClaimsREC.refundExecutedClaims[0].refundTxHash,
          validatorClaimsREC.refundExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.numberOfVotes(hash)).to.equal(1);
    });

    it("Should set voted on Bridging Request Claim", async function () {
      const { bridge, claimsHelper, owner, chain1, chain2, validators, validatorClaimsREC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const abiCoder = new ethers.AbiCoder();
      const encoded = abiCoder.encode(
        ["bytes32", "bytes32", "uint8"],
        [
          validatorClaimsREC.refundExecutedClaims[0].observedTransactionHash,
          validatorClaimsREC.refundExecutedClaims[0].refundTxHash,
          validatorClaimsREC.refundExecutedClaims[0].chainId,
        ]
      );

      const hash = ethers.keccak256(encoded);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.false;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsREC);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[1].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[2].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[3].address)).to.be.true;
      expect(await claimsHelper.hasVoted(hash, validators[4].address)).to.be.false;
    });

    it("Should TODO when Refund Executed Claim is confirmed", async function () {
      const { bridge, owner, validators, chain2, validatorClaimsREC, validatorsCardanoData } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsREC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsREC);

      // TODO: check some data that is not changed after refund executed claim consensus is not reached

      await bridge.connect(validators[3]).submitClaims(validatorClaimsREC);

      // TODO: check some data that is changed after refund executed claim consensus is reached
    });
  });

  describe("Transaction Confirmation", function () {
    it("GetConfirmedTransaction should not return transaction that occured after the timeout", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorClaimsBRC_ConfirmedTransactions,
        validatorsCardanoData,
        hre,
        claims,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

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
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
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
        .getConfirmedTransactions(validatorClaimsBRC_ConfirmedTransactions.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      expect(confirmedTxs.length).to.equal(1);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(
        await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)
      );
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
    });

    it("GetConfirmedTransactions should not return more transaction than MAX_NUMBER_OF_TRANSACTIONS", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData, claims, hre } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Bridge in order to set Next Timeout Block value
      const bridgeAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
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
            observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737600000000000000000000000000000000000000000000000000000000",
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
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC2.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainId).to.equal(validatorClaimsBRC2.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });

    it("GetConfirmedTransactions should return transactions with appropriate Observed Transaction Hashes", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData, claims, hre } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 1000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 1000, validatorsCardanoData);

      const firstTimestampBlockNumber = await ethers.provider.getBlockNumber();

      // Impersonate as Claims in order to set Next Timeout Block value
      const bridgeContratAddress = await bridge.getAddress();

      var signer = await impersonateAsContractAndMintFunds(bridgeContratAddress);

      await claims
        .connect(signer)
        .setNextTimeoutBlock(
          validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId,
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
            observedTransactionHash: "0x7465737700000000000000000000000000000000000000000000000000000000",
          },
        ],
      };

      const validatorClaimsBRC3 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737800000000000000000000000000000000000000000000000000000000",
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
        .getConfirmedTransactions(validatorClaimsBRC3.bridgingRequestClaims[0].destinationChainId);

      const expectedReceiversAddress = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].destinationAddress;
      const expectedReceiversAmount = validatorClaimsBRC.bridgingRequestClaims[0].receivers[0].amount;

      const blockNum = await claims.nextTimeoutBlock(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId);
      expect(confirmedTxs.length).to.equal(2);
      expect(confirmedTxs[0].nonce).to.equal(1);
      expect(confirmedTxs[0].observedTransactionHash).to.equal(
        validatorClaimsBRC.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[0].sourceChainId).to.equal(validatorClaimsBRC.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[0].blockHeight).to.be.lessThan(blockNum);
      expect(confirmedTxs[0].receivers[0].destinationAddress).to.equal(expectedReceiversAddress);
      expect(confirmedTxs[0].receivers[0].amount).to.equal(expectedReceiversAmount);
      expect(confirmedTxs[1].nonce).to.equal(2);
      expect(confirmedTxs[1].observedTransactionHash).to.equal(
        validatorClaimsBRC3.bridgingRequestClaims[0].observedTransactionHash
      );
      expect(confirmedTxs[1].sourceChainId).to.equal(validatorClaimsBRC3.bridgingRequestClaims[0].sourceChainId);
      expect(confirmedTxs[1].blockHeight).to.be.lessThan(blockNum);
    });
  });

  describe("Batch creation", function () {
    it("SignedBatch submition should return imediatelly if chain is not registered", async function () {
      const {
        bridge,
        validators,
        owner,
        chain1,
        chain2,
        validatorClaimsBRC,
        validatorsCardanoData,
        batchProposerData,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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
        destinationChainId: "unregisteredChainId1",
        rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
        multisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        feePayerMultisigSignature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        firstTxNonceId: 1,
        lastTxNonceId: 1,
        proposerData: batchProposerData,
      };

      await expect(bridge.connect(validators[0]).submitSignedBatch(signedBatch_UnregisteredChain)); // submitSignedBatch should return for unregistered chain
    });

    it("SignedBatch submition should be reverted if not called by validator", async function () {
      const { bridge, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitSignedBatch(signedBatch)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("SignedBatch submition in SignedBatches SC should be reverted if not called by Bridge SC", async function () {
      const { bridge, signedBatches, owner, signedBatch } = await loadFixture(deployBridgeFixture);

      await expect(
        signedBatches.connect(owner).submitSignedBatch(signedBatch, owner.address)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("If SignedBatch submition id is not expected submittion should be skipped", async function () {
      const { bridge, signedBatches, claimsHelper, validators, signedBatch } = await loadFixture(deployBridgeFixture);

      const oldId = signedBatch.id;
      signedBatch.id = 1000; //invalid id

      const hash = ethers.solidityPackedKeccak256(
        ["uint64", "uint64", "uint64", "uint8", "bytes"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
        ]
      );

      const bridgeContract = await impersonateAsContractAndMintFunds(await bridge.getAddress());

      await signedBatches.connect(bridgeContract).submitSignedBatch(signedBatch, validators[0].address);

      signedBatch.id = oldId;

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.equal(false);
    });

    it("SignedBatch submition should do nothing if shouldCreateBatch is false", async function () {
      const { bridge, claimsHelper, validators, signedBatch } = await loadFixture(deployBridgeFixture);

      const hash = ethers.solidityPackedKeccak256(
        ["uint64", "uint64", "uint64", "uint8", "bytes"],
        [
          signedBatch.id,
          signedBatch.firstTxNonceId,
          signedBatch.lastTxNonceId,
          signedBatch.destinationChainId,
          signedBatch.rawTransaction,
        ]
      );

      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

      expect(await claimsHelper.hasVoted(hash, validators[0].address)).to.equal(false);
    });

    it("getNextBatchId should return 0 if there are no confirmed claims", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);

      // wait for next timeout
      for (let i = 0; i < 10; i++) {
        await ethers.provider.send("evm_mine");
      }

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(0);
    });

    it("getNextBatchId should return correct id if there are enough confirmed claims", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      const validatorClaimsBRC2 = {
        ...validatorClaimsBRC,
        bridgingRequestClaims: [
          {
            ...validatorClaimsBRC.bridgingRequestClaims[0],
            observedTransactionHash: "0x7465737900000000000000000000000000000000000000000000000000000000",
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

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
    });

    it("getNextBatchId should return correct id if there is timeout", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorClaimsBRC, validatorsCardanoData } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 10000, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 10000, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[3]).submitClaims(validatorClaimsBRC);

      // wait for timeout
      await ethers.provider.send("evm_mine");
      await ethers.provider.send("evm_mine");

      expect(await bridge.getNextBatchId(validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId)).to.equal(1);
    });

    it("Should not create if current batch block is not -1", async function () {
      const {
        bridge,
        claims,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      expect(await claims.shouldCreateBatch(signedBatch.destinationChainId)).to.equal(false);
    });

    it("SignedBatch should be added to signedBatches if there are enough votes", async function () {
      const {
        bridge,
        claimsHelper,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch); // resubmit
      const confBatchNothing = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);
      expect(confBatchNothing.firstTxNonceId + confBatchNothing.lastTxNonceId).to.equal(0);

      // consensus
      await bridge.connect(validators[3]).submitSignedBatch(signedBatch);

      const confBatch = await claimsHelper
        .connect(validators[0])
        .getConfirmedSignedBatchData(signedBatch.destinationChainId, signedBatch.id);

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);

      expect(confBatch.firstTxNonceId).to.equal(signedBatch.firstTxNonceId);
      expect(confBatch.lastTxNonceId).to.equal(signedBatch.lastTxNonceId);
    });

    it("Should create ConfirmedBatch if there are enough votes", async function () {
      const { bridge, owner, chain1, chain2, validators, validatorsCardanoData, signedBatch, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[1]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[2]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        (await bridge.connect(validators[0]).getConfirmedBatch(signedBatch.destinationChainId)).multisigSignatures[3]
      ).to.equal("0x7465737400000000000000000000000000000000000000000000000000000000");
      expect(
        await bridge.connect(validators[0]).getRawTransactionFromLastBatch(signedBatch.destinationChainId)
      ).to.equal(signedBatch.rawTransaction);
    });

    it("Should create and execute batch after transactions are confirmed", async function () {
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        validatorClaimsBRC,
        validatorsCardanoData,
        signedBatch,
        validatorClaimsBEC,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      const _destinationChain = validatorClaimsBRC.bridgingRequestClaims[0].destinationChainId;

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
      const {
        bridge,
        owner,
        chain1,
        chain2,
        validators,
        signedBatch,
        validatorsCardanoData,
        validatorClaimsBRC,
        claims,
      } = await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

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

      const tokenAmount = await claims.getTokenQuantity(signedBatch.destinationChainId);

      let sumAmounts = 0;
      for (let i = 0; i < validatorClaimsBRC.bridgingRequestClaims[0].receivers.length; i++) {
        sumAmounts += validatorClaimsBRC.bridgingRequestClaims[0].receivers[i].amount;
      }

      expect(tokenAmount).to.equal(sumAmounts);
    });

    it("Should not store Proposed Data if not sent by proposer", async function () {
      const { bridge, owner, chain1, chain2, validators, signedBatch, validatorsCardanoData, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      //not validator
      await bridge.connect(validators[0]).submitSignedBatch(signedBatch);

      expect((await bridge.getBatcherProposedData(signedBatch.destinationChainId)).slot).to.equal(0);
    });

    it("Should store Proposed Data if proposed by proposer", async function () {
      const { bridge, owner, chain1, chain2, validators, signedBatch, validatorsCardanoData, validatorClaimsBRC } =
        await loadFixture(deployBridgeFixture);

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);
      await bridge.connect(owner).registerChain(chain2, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[1]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[2]).submitClaims(validatorClaimsBRC);
      await bridge.connect(validators[4]).submitClaims(validatorClaimsBRC);

      // wait for next timeout
      for (let i = 0; i < 3; i++) {
        await ethers.provider.send("evm_mine");
      }

      await bridge.connect(validators[1]).submitSignedBatch(signedBatch);

      expect((await bridge.getBatcherProposedData(signedBatch.destinationChainId)).slot).to.equal(1);
    });
  });

  describe("Slot management", function () {
    it("Should revert if chain is not registered", async function () {
      const { bridge, validators, cardanoBlocks } = await loadFixture(deployBridgeFixture);

      await expect(
        bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks)
      ).to.be.revertedWithCustomError(bridge, "ChainIsNotRegistered");
    });

    it("Should revert if not called by validator", async function () {
      const { bridge, owner, cardanoBlocks } = await loadFixture(deployBridgeFixture);

      await expect(bridge.connect(owner).submitLastObservedBlocks(1, cardanoBlocks)).to.be.revertedWithCustomError(
        bridge,
        "NotValidator"
      );
    });

    it("Should skip if validator submitted the same CardanoBlocks twice", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);
    });

    it("Should update CardanoBlock when there is quorum", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(0);

      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("Should not update CardanoBlock when slot is not newer", async function () {
      const { bridge, owner, validators, chain1, validatorsCardanoData, cardanoBlocks } = await loadFixture(
        deployBridgeFixture
      );

      await bridge.connect(owner).registerChain(chain1, 100, validatorsCardanoData);

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocks);
      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocks);

      var blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);

      const cardanoBlocksOld = [
        {
          blockSlot: 0,
          blockHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        },
      ];

      await bridge.connect(validators[0]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[1]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[2]).submitLastObservedBlocks(1, cardanoBlocksOld);
      await bridge.connect(validators[3]).submitLastObservedBlocks(1, cardanoBlocksOld);

      blockSlot = (await bridge.getLastObservedBlock(1)).blockSlot;
      expect(blockSlot).to.equal(cardanoBlocks[1].blockSlot);
    });

    it("updateBlocks from Slots SC should revert if not called by Bridge SC", async function () {
      const { bridge, slots, owner, cardanoBlocks } = await loadFixture(deployBridgeFixture);

      await expect(slots.connect(owner).updateBlocks(1, cardanoBlocks, owner.address)).to.be.revertedWithCustomError(
        bridge,
        "NotBridge"
      );
    });

    it("addValidatorCardanoData from Validators SC should revert if not called by Bridge SC", async function () {
      const { bridge, validatorsc, owner, validatorCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        validatorsc.connect(owner).addValidatorCardanoData(1, owner.address, validatorCardanoData)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });

    it("setValidatorsCardanoData from Validators SC should revert if not called by Bridge SC", async function () {
      const { bridge, validatorsc, owner, validatorAddressCardanoData } = await loadFixture(deployBridgeFixture);

      await expect(
        validatorsc.connect(owner).setValidatorsCardanoData(1, validatorAddressCardanoData)
      ).to.be.revertedWithCustomError(bridge, "NotBridge");
    });
  });
});
