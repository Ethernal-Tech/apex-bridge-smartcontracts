import { ethers } from "hardhat";
import {
  Bridge,
  Claims,
  SpecialClaims,
  SpecialSignedBatches,
  ClaimsHelper,
  SignedBatches,
  Slots,
  Validators,
  Admin,
} from "../typechain-types";

export enum TransactionType {
  NORMAL = 0,
  DEFUND = 1,
  REFUND = 2,
  STAKE = 3,
  REDISTRIBUTION = 4,
}

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

  const SpecialClaims = await ethers.getContractFactory("SpecialClaims");
  const specialClaimsLogic = await SpecialClaims.deploy();

  const SpecialSignedBatches = await ethers.getContractFactory("SpecialSignedBatches");
  const specialSignedBatchesLogic = await SpecialSignedBatches.deploy();

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
  const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SpecialClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SpecialSignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorscProxy = await ethers.getContractFactory("ERC1967Proxy");
  const AdminProxy = await ethers.getContractFactory("ERC1967Proxy");

  const bridgeProxy = await BridgeProxy.deploy(
    await bridgeLogic.getAddress(),
    Bridge.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const claimsProxy = await ClaimsProxy.deploy(
    await claimsLogic.getAddress(),
    Claims.interface.encodeFunctionData("initialize", [owner.address, owner.address, 2, 5])
  );

  const specialClaimsProxy = await SpecialClaimsProxy.deploy(
    await specialClaimsLogic.getAddress(),
    SpecialClaims.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const specialSignedBatchesProxy = await SpecialSignedBatchesProxy.deploy(
    await specialSignedBatchesLogic.getAddress(),
    SpecialSignedBatches.interface.encodeFunctionData("initialize", [owner.address, owner.address])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelperLogic.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [owner.address, owner.address])
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

  const ClaimsDeployed = await ethers.getContractFactory("Claims");
  const claims = ClaimsDeployed.attach(claimsProxy.target) as Claims;

  const SpecialClaimsDeployed = await ethers.getContractFactory("SpecialClaims");
  const specialClaims = SpecialClaimsDeployed.attach(specialClaimsProxy.target) as SpecialClaims;

  const SpecialSignedBatchesDeployed = await ethers.getContractFactory("SpecialSignedBatches");
  const specialSignedBatches = SpecialSignedBatchesDeployed.attach(
    specialSignedBatchesProxy.target
  ) as SpecialSignedBatches;

  const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelper = ClaimsHelperDeployed.attach(claimsHelperProxy.target) as ClaimsHelper;

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
    specialClaimsProxy.target,
    specialSignedBatchesProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    validatorsProxy.target
  );

  await claimsHelper.setDependencies(claims.target, signedBatches.target);

  await claims.setDependencies(bridge.target, claimsHelper.target, validatorsc.target, admin.target);

  await specialClaims.setDependencies(bridge.target, claims.target, claimsHelper.target, validatorsc.target);

  await specialClaims.setDependencies(bridge.target, signedBatches.target, claimsHelper.target, validatorsc.target);

  await signedBatches.setDependencies(bridge.target, specialClaims.target, claimsHelper.target, validatorsc);

  await slots.setDependencies(bridge.target, validatorsc.target);

  await validatorsc.setDependencies(bridge.target);

  await admin.setDependencies(claims.target);

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
    chainType: 1, // evm chain
  };

  const validatorClaimsBRC = {
    bridgingRequestClaims: [
      {
        observedTransactionHash: "0x7465737400000000000000000000000000000000000000000000000000000000",
        totalAmountSrc: 100,
        totalAmountDst: 99,
        retryCounter: 0,
        receivers: [
          {
            amount: 99,
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
      receivers: [
        {
          amount: 1,
          destinationAddress: `0x123...${i}`,
        },
      ],
      totalAmountSrc: 1,
      totalAmountDst: 1,
      retryCounter: 0,
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
      totalAmountSrc: 100 + i,
      totalAmountDst: 99 + i,
      retryCounter: 0,
      receivers: [
        {
          amount: 99 + i,
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

  const validatorSets = Array.from({ length: 2 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 5 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: `0x${addrNum}`,
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  const validatorSets_notEnoughChains = Array.from({ length: 1 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 5 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: `0x${addrNum}`,
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  const validatorSets_TooManyChains = Array.from({ length: 3 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 5 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: `0x${addrNum}`,
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  const validatorSets_NotEnoughValidators = Array.from({ length: 2 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 3 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: `0x${addrNum}`,
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  const validatorSets_TooManyValidators = Array.from({ length: 2 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 127 }, (_, j) => {
        const addrNum = (i * 127 + j + 1).toString(16).padStart(40, "0");

        // Generate 4-byte (8 hex digit) valid hex strings
        const suffix = (j + 1).toString(16).padStart(2, "0"); // e.g., "01"
        const keySignature = `0x${"abc0" + suffix}`.padEnd(10, "0"); // 10 chars = 0x + 8 hex digits
        const keyFeeSignature = `0x${"def0" + suffix}`.padEnd(10, "0");

        return {
          addr: `0x${addrNum}`,
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature,
          keyFeeSignature,
        };
      }),
    };
  });

  const validatorSets_ZeroAddress = Array.from({ length: 2 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 5 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: "0x0000000000000000000000000000000000000000",
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  const validatorSets_DoubleAddress = Array.from({ length: 2 }, (_, i) => {
    const chainId = i + 1;
    return {
      chainId,
      validators: Array.from({ length: 5 }, (_, j) => {
        const addrNum = (i * 5 + j + 1).toString(16).padStart(40, "0");
        return {
          addr: "0x0000000000000000000000000000000000000001",
          data: {
            key: [j * 4 + 1, j * 4 + 2, j * 4 + 3, j * 4 + 4],
          },
          keySignature: `0xabc${j + 1}`,
          keyFeeSignature: `0xdef${j + 1}`,
        };
      }),
    };
  });

  return {
    hre,
    bridge,
    claimsHelper,
    claims,
    specialClaims,
    specialSignedBatches,
    signedBatches,
    slots,
    admin,
    owner,
    chain1,
    chain2,
    validatorsc,
    validator6,
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
    validators,
    cardanoBlocks,
    cardanoBlocksTooManyBlocks,
    validatorSets,
    validatorSets_notEnoughChains,
    validatorSets_TooManyChains,
    validatorSets_NotEnoughValidators,
    validatorSets_TooManyValidators,
    validatorSets_ZeroAddress,
    validatorSets_DoubleAddress,
  };
}

export function hashBridgeRequestClaim(claim: any) {
  const abiCoder = new ethers.AbiCoder();
  const encodedPrefix = abiCoder.encode(["string"], ["BRC"]);
  const lst = [];
  for (let receiver of claim.receivers) {
    lst.push([receiver.amount, receiver.destinationAddress]);
  }

  const encoded = abiCoder.encode(
    ["bytes32", "tuple(uint256, string)[]", "uint256", "uint256", "uint256", "uint8", "uint8"],
    [
      claim.observedTransactionHash,
      lst,
      claim.totalAmountSrc,
      claim.totalAmountDst,
      claim.retryCounter,
      claim.sourceChainId,
      claim.destinationChainId,
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
    ["bytes32", "bytes32", "uint256", "bytes", "string", "uint64", "uint8", "bool"],
    [
      claim.originTransactionHash,
      claim.refundTransactionHash,
      claim.originAmount,
      claim.outputIndexes,
      claim.originSenderAddress,
      claim.retryCounter,
      claim.originChainId,
      claim.shouldDecrementHotWallet,
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
  const encoded = abiCoder.encode(["uint8", "uint256"], [claim.chainId, claim.amount]);
  return ethers.keccak256(
    "0x0000000000000000000000000000000000000000000000000000000000000060" +
      encoded.substring(2) +
      encodedPrefix.substring(66)
  );
}
