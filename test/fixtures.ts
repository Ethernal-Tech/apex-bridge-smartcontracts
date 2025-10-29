import { ethers } from "hardhat";
import {
  Bridge,
  Claims,
  ClaimsHelper,
  SignedBatches,
  Slots,
  Validators,
  Admin,
  BridgingAddresses,
  ChainTokens,
} from "../typechain-types";
import { setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";

export enum BatchType {
  NORMAL = 0,
  CONSOLIDATION = 1,
  VALIDATORSET = 2,
  VALIDATORSET_FINAL = 3,
}

export enum TransactionType {
  NORMAL = 0,
  DEFUND = 1,
  REFUND = 2,
  STAKE = 3,
  REDISTRIBUTION = 4,
}

export enum TransactionSubType {
  STAKE_REGISTRATION = 0,
  STAKE_DELEGATION = 1,
  STAKE_DEREGISTRATION = 2,
}

export async function deployBridgeFixture() {
  const PRECOMPILE_MOCK = "0x600160005260206000F3"; // returns true for isSignatureValid

  await setCode("0x0000000000000000000000000000000000002050", PRECOMPILE_MOCK);
  await setCode("0x0000000000000000000000000000000000002060", PRECOMPILE_MOCK);

  // Contracts are deployed using the first signer/account by default
  const [owner, validator1, validator2, validator3, validator4, validator5] = await ethers.getSigners();
  const validators = [validator1, validator2, validator3, validator4, validator5];

  const Bridge = await ethers.getContractFactory("Bridge");
  const bridgeLogic = await Bridge.deploy();

  const BridgingAddresses = await ethers.getContractFactory("BridgingAddresses");
  const bridgingAddressesLogic = await BridgingAddresses.deploy();

  const ChainTokens = await ethers.getContractFactory("ChainTokens");
  const chainTokensLogic = await ChainTokens.deploy();

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

  const Admin = await ethers.getContractFactory("Admin");
  const adminLogic = await Admin.deploy();

  // deployment of contract proxy
  const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
  const BridgingAddressesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ChainTokensProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
  const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");

  const bridgeProxy = await BridgeProxy.deploy(
    await bridgeLogic.getAddress(),
    Bridge.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const bridgingAddressesProxy = await BridgingAddressesProxy.deploy(
    await bridgingAddressesLogic.getAddress(),
    BridgingAddresses.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const chainTokensProxy = await ChainTokensProxy.deploy(
    await chainTokensLogic.getAddress(),
    ChainTokens.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelperLogic.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const claimsProxy = await ClaimsProxy.deploy(
    await claimsLogic.getAddress(),
    Claims.interface.encodeFunctionData("initialize", [owner.address, owner.address, 2, 5])
  );

  const signedBatchesProxy = await SignedBatchesProxy.deploy(
    await signedBatchesLogic.getAddress(),
    SignedBatches.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const slotsProxy = await SlotsProxy.deploy(
    await slotsLogic.getAddress(),
    Slots.interface.encodeFunctionData("initialize", [owner.address, owner.address])
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
    Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, validatorsAddresses])
  );

  const adminProxy = await AdminProxy.deploy(
    await adminLogic.getAddress(),
    Admin.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  //casting proxy contracts to contract logic
  const BridgeDeployed = await ethers.getContractFactory("Bridge");
  const bridge = BridgeDeployed.attach(bridgeProxy.target) as Bridge;

  const BridgingAddressesDeployed = await ethers.getContractFactory("BridgingAddresses");
  const bridgingAddresses = BridgingAddressesDeployed.attach(bridgingAddressesProxy.target) as BridgingAddresses;

  const ChainTokensDeployed = await ethers.getContractFactory("ChainTokens");
  const chainTokens = ChainTokensDeployed.attach(chainTokensProxy.target) as ChainTokens;

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

  const AdminDeployed = await ethers.getContractFactory("Admin");
  const admin = AdminDeployed.attach(adminProxy.target) as Admin;

  await bridge.setDependencies(
    claimsProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    validatorsProxy.target
  );

  await bridgingAddresses.setDependencies(bridge.target, claims.target, admin.target);

  await bridge.setBridgingAddrsDependencyAndSync(bridgingAddressesProxy.target);

  await bridge.setChainTokensDependency(chainTokensProxy.target);

  await chainTokens.setDependencies(bridge.target, claims.target, admin.target);

  await claimsHelper.setDependencies(claims.target, signedBatches.target);

  await claims.setDependencies(bridge.target, claimsHelper.target, validatorsc.target, admin.target);

  await claims.setBridgingAddrsDependencyAndSync(bridgingAddressesProxy.target);

  await claims.setChainTokensDependencyAndSync(chainTokensProxy.target);

  await signedBatches.setDependencies(bridge.target, claimsHelper.target, validatorsc);

  await slots.setDependencies(bridge.target, validatorsc.target);

  await validatorsc.setDependencies(bridge.target);

  await admin.setDependencies(claims.target);

  await admin.setBridgingAddrsDependency(bridgingAddressesProxy.target);

  await admin.setChainTokensDependency(chainTokensProxy.target);

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
    chainType: 1,
  };

  const validatorClaimsBRC = {
    bridgingRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        receivers: [
          {
            amount: 100,
            amountWrapped: 100,
            destinationAddress: "0x123...",
          },
        ],
        nativeCurrencyAmountSource: 100,
        wrappedTokenAmountSource: 100,
        nativeCurrencyAmountDestination: 100,
        wrappedTokenAmountDestination: 100,
        retryCounter: 0,
        sourceChainId: 1,
        destinationChainId: 2,
        bridgeAddrIndex: 1,
        coloredCoinId: 0,
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
      receivers: [
        {
          amount: 100 + i,
          amountWrapped: 100 + i,
          destinationAddress: `0x123...${i}`,
        },
      ],
      nativeCurrencyAmountSource: 100,
      wrappedTokenAmountSource: 0,
      nativeCurrencyAmountDestination: 100,
      wrappedTokenAmountDestination: 0,
      retryCounter: 0,
      sourceChainId: 1,
      destinationChainId: 2,
      bridgeAddrIndex: 1,
      coloredCoinId: 0,
    })),
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [],
    hotWalletIncrementClaims: [],
  };

  const validatorClaimsBRC_bunch33 = {
    bridgingRequestClaims: Array.from({ length: 33 }, (_, i) => ({
      observedTransactionHash: "0x" + Buffer.from(`test${i}`).toString("hex").padEnd(64, "0").slice(0, 64),
      receivers: [
        {
          amount: 100 + i,
          amountWrapped: 100 + i,
          destinationAddress: `0x123...${i}`,
        },
      ],
      nativeCurrencyAmountSource: 100,
      wrappedTokenAmountSource: 0,
      nativeCurrencyAmountDestination: 100,
      wrappedTokenAmountDestination: 0,
      retryCounter: 0,
      sourceChainId: 1,
      destinationChainId: 2,
      bridgeAddrIndex: 1,
      coloredCoinId: 0,
    })),
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

  const validatorClaimsRRC = {
    bridgingRequestClaims: [],
    batchExecutedClaims: [],
    batchExecutionFailedClaims: [],
    refundRequestClaims: [
      {
        originTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        refundTransactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        originAmount: 100,
        originWrappedAmount: 100,
        outputIndexes: "0x7465737400000000000000000000000000000000000000000000000000000000",
        originSenderAddress: "receiver1",
        retryCounter: 0,
        originChainId: 2,
        shouldDecrementHotWallet: false,
        destinationChainId: 1,
        bridgeAddrIndex: 1,
        coloredCoinId: 0,
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
        amountWrapped: 100,
        coloredCoinId: 0,
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
    batchType: BatchType.NORMAL,
    stakeSignature: "0x746573740000000000000000000000000000000000000000000000000000000B",
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

  const coloredCoin = {
    chainId: 1,
    coloredCoinId: 1,
  };

  const validatorCardanoData = validatorAddressChainData[0].data;
  const bridgeAddrIndex = 0;

  return {
    admin,
    bridge,
    bridgingAddresses,
    chainTokens,
    claims,
    claimsHelper,
    signedBatches,
    slots,
    validatorsc,
    owner,
    validators,
    chain1,
    chain2,
    validatorClaimsBRC,
    validatorClaimsBRC_bunch32,
    validatorClaimsBRC_bunch33,
    validatorClaimsBEC,
    validatorClaimsBEFC,
    validatorClaimsRRC,
    validatorClaimsHWIC,
    signedBatch,
    validatorAddressChainData,
    validatorCardanoData,
    cardanoBlocks,
    bridgeAddrIndex,
    coloredCoin,
  };
}

export function hashBridgeRequestClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
  const lst = [];
  for (let receiver of claim.receivers) {
    lst.push([receiver.amount, receiver.amountWrapped, receiver.destinationAddress]);
  }

  const encoded = abiCoder.encode(
    [
      "bytes32",
      "tuple(uint256, uint256, string)[]",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint8",
      "uint8",
      "uint8",
      "uint8",
    ],
    [
      claim.observedTransactionHash,
      lst,
      claim.nativeCurrencyAmountSource,
      claim.wrappedTokenAmountSource,
      claim.nativeCurrencyAmountDestination,
      claim.wrappedTokenAmountDestination,
      claim.retryCounter,
      claim.sourceChainId,
      claim.destinationChainId,
      claim.bridgeAddrIndex,
      claim.coloredCoinId,
    ]
  );

  return ethers.keccak256(
    "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    encodedPrefix.substring(66) +
    encoded.substring(2)
  );
}

export function hashBatchExecutedClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BEC"]);
  const encoded = abiCoder.encode(
    ["bytes32", "uint64", "uint8"],
    [claim.observedTransactionHash, claim.batchNonceId, claim.chainId]
  );

  return ethers.keccak256(
    "0x0000000000000000000000000000000000000000000000000000000000000080" +
    encoded.substring(2) +
    encodedPrefix.substring(66)
  );
}

export function hashBatchExecutionFailedClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BEFC"]);
  const encoded = abiCoder.encode(
    ["bytes32", "uint64", "uint8"],
    [claim.observedTransactionHash, claim.batchNonceId, claim.chainId]
  );

  return ethers.keccak256(
    "0x0000000000000000000000000000000000000000000000000000000000000080" +
    encoded.substring(2) +
    encodedPrefix.substring(66)
  );
}

export function hashRefundRequestClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["RRC"]);
  const encoded = abiCoder.encode(
    [
      "bytes32",
      "bytes32",
      "uint256",
      "uint256",
      "bytes",
      "string",
      "uint64",
      "uint8",
      "bool",
      "uint8",
      "uint8",
      "uint8",
    ],
    [
      claim.originTransactionHash,
      claim.refundTransactionHash,
      claim.originAmount,
      claim.originWrappedAmount,
      claim.outputIndexes,
      claim.originSenderAddress,
      claim.retryCounter,
      claim.originChainId,
      claim.shouldDecrementHotWallet,
      claim.destinationChainId,
      claim.bridgeAddrIndex,
      claim.coloredCoinId,
    ]
  );
  return ethers.keccak256(
    "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080" +
    encodedPrefix.substring(66) +
    encoded.substring(2)
  );
}

export function hashHotWalletIncrementClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["HWIC"]);
  const encoded = abiCoder.encode(
    ["uint8", "uint256", "uint256", "uint8"],
    [claim.chainId, claim.amount, claim.amountWrapped, claim.coloredCoinId]
  );

  return ethers.keccak256(
    "0x00000000000000000000000000000000000000000000000000000000000000a0" +
    encoded.substring(2) +
    encodedPrefix.substring(66)
  );
}
