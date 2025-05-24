import { ethers } from "hardhat";
import {
  Admin,
  Bridge,
  Claims,
  ClaimsHelper,
  SignedBatches,
  Slots,
  Validators,
  FundGovernor,
  FundToken,
  OwnerGovernor,
  OwnerToken,
} from "../typechain-types";

export async function deployBridgeFixture() {
  // Contracts are deployed using the first signer/account by default
  const [
    owner,
    validator1,
    validator2,
    validator3,
    validator4,
    validator5,
    validator6,
    governor1,
    governor2,
    governor3,
    governor4,
    governor5,
  ] = await ethers.getSigners();
  const validators = [validator1, validator2, validator3, validator4, validator5];

  const hre = require("hardhat");

  const FundToken = await ethers.getContractFactory("FundToken");
  const fundTokenLogic = await FundToken.deploy();

  const FundGovernor = await ethers.getContractFactory("FundGovernor");
  const fundGovernorLogic = await FundGovernor.deploy();

  const OwnerToken = await ethers.getContractFactory("OwnerToken");
  const ownerTokenLogic = await OwnerToken.deploy();

  const OwnerGovernor = await ethers.getContractFactory("OwnerGovernor");
  const ownerGovernorLogic = await OwnerGovernor.deploy();

  const Admin = await ethers.getContractFactory("Admin");
  const adminLogic = await Admin.deploy();

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
  const FundTokenProxy = await ethers.getContractFactory("ERC1967Proxy");
  const FundGovernorProxy = await ethers.getContractFactory("ERC1967Proxy");
  const OwnerTokenProxy = await ethers.getContractFactory("ERC1967Proxy");
  const OwnerGovernorProxy = await ethers.getContractFactory("ERC1967Proxy");
  const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");
  const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");

  const fundTokenProxy = await FundTokenProxy.deploy(
    await fundTokenLogic.getAddress(),
    FundToken.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const fundGovernorProxy = await FundGovernorProxy.deploy(
    await fundGovernorLogic.getAddress(),
    FundGovernor.interface.encodeFunctionData("initialize", [await fundTokenProxy.getAddress(), owner.address])
  );

  const ownerTokenProxy = await OwnerTokenProxy.deploy(
    await ownerTokenLogic.getAddress(),
    OwnerToken.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const ownerGovernorProxy = await OwnerGovernorProxy.deploy(
    await ownerGovernorLogic.getAddress(),
    OwnerGovernor.interface.encodeFunctionData("initialize", [await ownerTokenProxy.getAddress(), owner.address])
  );

  const adminProxy = await AdminProxy.deploy(
    await adminLogic.getAddress(),
    Admin.interface.encodeFunctionData("initialize", [
      owner.address,
      await ownerGovernorProxy.getAddress(),
      await fundGovernorProxy.getAddress(),
    ])
  );

  const bridgeProxy = await BridgeProxy.deploy(
    await bridgeLogic.getAddress(),
    Bridge.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorProxy.getAddress()])
  );

  const claimsProxy = await ClaimsProxy.deploy(
    await claimsLogic.getAddress(),
    Claims.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorProxy.getAddress(), 2, 5])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelperLogic.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorProxy.getAddress()])
  );

  const signedBatchesProxy = await SignedBatchesProxy.deploy(
    await signedBatchesLogic.getAddress(),
    SignedBatches.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorProxy.getAddress()])
  );

  const slotsProxy = await SlotsProxy.deploy(
    await slotsLogic.getAddress(),
    Slots.interface.encodeFunctionData("initialize", [owner.address, await ownerGovernorProxy.getAddress()])
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
    Validators.interface.encodeFunctionData("initialize", [
      owner.address,
      await ownerGovernorProxy.getAddress(),
      validatorsAddresses,
    ])
  );

  //casting proxy contracts to contract logic

  const FundTokenDeployed = await ethers.getContractFactory("FundToken");
  const fundToken = FundTokenDeployed.attach(fundTokenProxy.target) as FundToken;

  const FundGovernorDeployed = await ethers.getContractFactory("FundGovernor");
  const fundGovernor = FundGovernorDeployed.attach(fundGovernorProxy.target) as FundGovernor;

  const OwnerTokenDeployed = await ethers.getContractFactory("OwnerToken");
  const ownerToken = OwnerTokenDeployed.attach(ownerTokenProxy.target) as OwnerToken;

  const OwnerGovernorDeployed = await ethers.getContractFactory("OwnerGovernor");
  const ownerGovernor = OwnerGovernorDeployed.attach(ownerGovernorProxy.target) as OwnerGovernor;

  const AdminDeployed = await ethers.getContractFactory("Admin");
  const admin = AdminDeployed.attach(adminProxy.target) as Admin;

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

  await fundToken.setDependencies(fundGovernor.target);
  await ownerToken.setDependencies(ownerGovernor.target);

  await admin.setDependencies(claims.target);

  await bridge.setDependencies(
    claimsProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    validatorsProxy.target
  );

  await claimsHelper.setDependencies(claims.target, signedBatches.target);

  await claims.setDependencies(bridge.target, claimsHelper.target, validatorsc.target, admin.target);

  await signedBatches.setDependencies(bridge.target, claimsHelper.target, validatorsc);

  await slots.setDependencies(bridge.target, validatorsc.target);

  await validatorsc.setDependencies(bridge.target);

  await ownerToken.transfer(governor1.address, 1n * 10n ** 18n);
  await ownerToken.transfer(governor2.address, 1n * 10n ** 18n);
  await ownerToken.transfer(governor3.address, 1n * 10n ** 18n);
  await ownerToken.transfer(governor4.address, 1n * 10n ** 18n);
  await ownerToken.transfer(governor5.address, 1n * 10n ** 18n);

  await ownerToken.connect(governor1).delegate(governor1.address);
  await ownerToken.connect(governor2).delegate(governor2.address);
  await ownerToken.connect(governor3).delegate(governor3.address);
  await ownerToken.connect(governor4).delegate(governor4.address);
  await ownerToken.connect(governor5).delegate(governor5.address);

  await fundToken.transfer(governor1.address, 1n * 10n ** 18n);
  await fundToken.transfer(governor2.address, 1n * 10n ** 18n);
  await fundToken.transfer(governor3.address, 1n * 10n ** 18n);
  await fundToken.transfer(governor4.address, 1n * 10n ** 18n);
  await fundToken.transfer(governor5.address, 1n * 10n ** 18n);

  await fundToken.connect(governor1).delegate(governor1.address);
  await fundToken.connect(governor2).delegate(governor2.address);
  await fundToken.connect(governor3).delegate(governor3.address);
  await fundToken.connect(governor4).delegate(governor4.address);
  await fundToken.connect(governor5).delegate(governor5.address);

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
    chainType: 1, // nexus chain
  };

  const validatorClaimsBRC = {
    bridgingRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        totalAmount: 100,
        retryCounter: 0,
        receivers: [
          {
            amount: 100,
            destinationAddress: "0x123...",
          },
        ],
        sourceChainId: 1,
        destinationChainId: 2,
      },
    ],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBRC_bunch32 = {
    bridgingRequestClaims: Array.from({ length: 32 }, (_, i) => ({
      observedTransactionHash: "0x" + Buffer.from(`test${i}`).toString("hex").padEnd(64, "0").slice(0, 64),
      totalAmount: 100 + i,
      retryCounter: 0,
      receivers: [
        {
          amount: 100 + i,
          destinationAddress: `0x123...${i}`,
        },
      ],
      sourceChainId: 1,
      destinationChainId: 2,
    })),
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBRC_bunch33 = {
    bridgingRequestClaims: Array.from({ length: 33 }, (_, i) => ({
      observedTransactionHash: "0x" + Buffer.from(`test${i}`).toString("hex").padEnd(64, "0").slice(0, 64),
      totalAmount: 100 + i,
      retryCounter: 0,
      receivers: [
        {
          amount: 100 + i,
          destinationAddress: `0x123...${i}`,
        },
      ],
      sourceChainId: 1,
      destinationChainId: 2,
    })),
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBRC_confirmedTransactions = {
    bridgingRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        totalAmount: 100,
        retryCounter: 0,
        receivers: [
          {
            destinationAddress: "0x234...",
            amount: 100,
          },
        ],
        sourceChainId: 1,
        destinationChainId: 2,
      },
    ],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBRC_tooManyReceivers = {
    bridgingRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        totalAmount: 100,
        retryCounter: 0,
        sourceChainId: 1,
        receivers: [
          ...Array.from({ length: 17 }, (_, i) => ({
            destinationAddress: `0x123...${(i + 1).toString().padStart(8, "0")}`,
            amount: 100 + i,
          })),
        ],
        destinationChainId: 2,
      },
    ],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
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
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBEC_another = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [
      {
        observedTransactionHash: "0x7465737500000000000000000000000000000000000000000000000000000001",
        chainId: 2,
        batchNonceId: 1,
      },
    ],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
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
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBEFC_another = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000001",
        chainId: 2,
        batchNonceId: 1,
      },
    ],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsRRC = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [
      {
        originTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        refundTransactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        originAmount: 100,
        outputIndexes: "0x7465737400000000000000000000000000000000000000000000000000000000",
        originSenderAddress: "receiver1",
        retryCounter: 0,
        originChainId: 2,
        shouldDecrementHotWallet: false,
      },
    ],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsRRC_wrongHash = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [
      {
        originTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        refundTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000001",
        originAmount: 100,
        outputIndexes: "0x7465737400000000000000000000000000000000000000000000000000000000",
        originSenderAddress: "receiver1",
        retryCounter: 0,
        originChainId: 2,
        shouldDecrementHotWallet: false,
      },
    ],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsHWIC = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [
      {
        chainId: 1,
        amount: 100,
      },
    ],
  };

  const signedBatch = {
    id: 1,
    firstTxNonceId: 1,
    lastTxNonceId: 1,
    destinationChainId: 2,
    signature: "0x746573740000000000000000000000000000000000000000000000000000000A",
    feeSignature: "0x746573740000000000000000000000000000000000000000000000000000000F",
    rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
    isConsolidation: false,
  };

  const signedBatchConsolidation = {
    id: 1,
    destinationChainId: 2,
    rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
    signature: "0x746573740000000000000000000000000000000000000000000000000000000A",
    feeSignature: "0x746573740000000000000000000000000000000000000000000000000000000F",
    firstTxNonceId: 0,
    lastTxNonceId: 0,
    isConsolidation: true,
  };

  const signedBatchDefund = {
    id: 1,
    firstTxNonceId: 1,
    lastTxNonceId: 2,
    destinationChainId: 2,
    signature: "0x746573740000000000000000000000000000000000000000000000000000000A",
    feeSignature: "0x746573740000000000000000000000000000000000000000000000000000000F",
    rawTransaction: "0x7465737400000000000000000000000000000000000000000000000000000000",
    isConsolidation: false,
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

  const cardanoBlocksTooManyBlocks = Array.from({ length: 41 }, (_, i) => ({
    blockSlot: i + 1,
    blockHash: `0x${"74657374".padEnd(64, "0")}${(i + 1).toString(16).padStart(2, "0")}`.slice(0, 66),
  }));

  const validatorAddressChainData = validators.map((val, index) => ({
    addr: val.address,
    data: {
      key: [
        (4n * BigInt(index)).toString(),
        (4n * BigInt(index) + 1n).toString(),
        (4n * BigInt(index) + 2n).toString(),
        (4n * BigInt(index) + 3n).toString(),
      ],
    },
    keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  }));

  const validatorCardanoData = validatorAddressChainData[0].data;

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

  const ownerGovernorContract = await impersonateAsContractAndMintFunds(await ownerGovernor.getAddress());
  const fundGovernorContract = await impersonateAsContractAndMintFunds(await fundGovernor.getAddress());

  return {
    hre,
    admin,
    bridge,
    claimsHelper,
    claims,
    signedBatches,
    validatorsc,
    ownerGovernor,
    ownerToken,
    fundGovernor,
    fundToken,
    slots,
    owner,
    ownerGovernorContract,
    fundGovernorContract,
    chain1,
    chain2,
    validator6,
    validatorClaimsBRC,
    validatorClaimsBRC_bunch32,
    validatorClaimsBRC_bunch33,
    validatorClaimsBEC,
    validatorClaimsBEC_another,
    validatorClaimsBEFC,
    validatorClaimsBEFC_another,
    validatorClaimsRRC,
    validatorClaimsHWIC,
    validatorClaimsRRC_wrongHash,
    validatorClaimsBRC_confirmedTransactions,
    validatorClaimsBRC_tooManyReceivers,
    signedBatch,
    signedBatchConsolidation,
    signedBatchDefund,
    validatorAddressChainData,
    validatorCardanoData,
    validators,
    cardanoBlocks,
    cardanoBlocksTooManyBlocks,
    governor1,
    governor2,
    governor3,
    governor4,
    governor5,
  };
}
