import { ethers } from "hardhat";
import { Bridge, Claims, ClaimsHelper, IBridge, SignedBatches, Slots, Validators } from "../typechain-types";

export async function deployBridgeFixture() {
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
    Bridge.interface.encodeFunctionData("initialize", [owner.address])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelperLogic.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [owner.address])
  );

  const claimsProxy = await ClaimsProxy.deploy(
    await claimsLogic.getAddress(),
    Claims.interface.encodeFunctionData("initialize", [owner.address, 2, 5])
  );

  const signedBatchesProxy = await SignedBatchesProxy.deploy(
    await signedBatchesLogic.getAddress(),
    SignedBatches.interface.encodeFunctionData("initialize", [owner.address])
  );

  const slotsProxy = await SlotsProxy.deploy(
    await slotsLogic.getAddress(),
    Slots.interface.encodeFunctionData("initialize", [owner.address])
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
    Validators.interface.encodeFunctionData("initialize", [owner.address, validatorsAddresses])
  );

  //casting proxy contracts to contract logic
  const BridgeDeployed = await ethers.getContractFactory("Bridge");
  const bridge = BridgeDeployed.attach(bridgeProxy.target) as Bridge;

  const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelper = ClaimsHelperDeployed.attach(claimsHelperProxy.target) as ClaimsHelper;

  const ClaimsDeployed = await ethers.getContractFactory("Claims");
  const claims = ClaimsDeployed.attach(claimsProxy.target) as Claims;

  const SignedBatchesDeployed = await ethers.getContractFactory("SignedBatches");
  const signedBatches = SignedBatchesDeployed.attach(signedBatchesProxy.target) as SignedBatches;

  const SlotsDeployed = await ethers.getContractFactory("Slots");
  const slots = SlotsDeployed.attach(slotsProxy.target) as Slots;

  const ValidatorsDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorsDeployed.attach(validatorsProxy.target) as Validators;

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
    chainType: 0, // cardano chain
  };

  const chain2 = {
    id: 2,
    addressMultisig: "addr_test1vr8zy7jk35n9yyw4jg0r4z98eygmrqxvz5sch4dva9c8s2qjv2edc",
    addressFeePayer: "addr_test1vz8g63va7qat4ajyja4sndp06rv3penf3htqcwt6x4znyacfpea75",
    chainType: 0,
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
        outputUTXO: {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 1,
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
    hotWalletIncrementClaims: [],
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
    hotWalletIncrementClaims: [],
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
        },
        sourceChainId: 1,
        destinationChainId: 2,
      },
    ],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    refundExecutedClaims: [],
    hotWalletIncrementClaims: [],
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
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBECerror = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        chainId: 2,
        batchNonceId: 1111111111,
      },
    ],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    refundExecutedClaims: [],
    hotWalletIncrementClaims: [],
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
    hotWalletIncrementClaims: [],
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
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsRRC = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        previousRefundTxHash: "0x7465737300000000000000000000000000000000000000000000000000000000",
        signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
        retryCounter: 1,
        chainId: 2,
        receiver: "receiver1",
      },
    ],
    refundExecutedClaims: [],
    hotWalletIncrementClaims: [],
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
        },
        rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
        signature: "0x7465737400000000000000000000000000000000000000000000000000000000",
        retryCounter: 1,
      },
    ],
    refundExecutedClaims: [],
    hotWalletIncrementClaims: [],
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
        },
      },
    ],
    hotWalletIncrementClaims: [],
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
        },
      },
    ],
    hotWalletIncrementClaims: [],
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
        },
      },
    ],
    hotWalletIncrementClaims: [],
  };

  const signedBatch = {
    id: 1,
    destinationChainId: 2,
    rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
    signature: "0x746573740000000000000000000000000000000000000000000000000000000A",
    feeSignature: "0x746573740000000000000000000000000000000000000000000000000000000F",
    firstTxNonceId: 1,
    lastTxNonceId: 1,
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
    validatorsCardanoData.push({
      addr: val.address,
      data: {
        key: [BigInt(4 * ind), BigInt(4 * ind + 1), BigInt(4 * ind + 2), BigInt(4 * ind + 3)],
      },
    });
    ind++;
  }

  const validatorCardanoData = validatorsCardanoData[0].data;

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
  };
}
