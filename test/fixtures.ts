import { ethers } from "hardhat";

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
          nonce: 0,
          amount: 400,
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
    usedUTXOs: {
      multisigOwnedUTXOs: [
        {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 0,
          nonce: 0,
          amount: 200,
        },
        {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 2,
          nonce: 0,
          amount: 50,
        },
      ],
      feePayerOwnedUTXOs: [
        {
          txHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
          txIndex: 1,
          nonce: 0,
          amount: 50,
        },
      ],
    },
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
