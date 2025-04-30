import { ethers } from "hardhat";

async function main() {
  const config = require("./config.json");

  //deployment of contract logic
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
  const ValidatorsProxy = await ethers.getContractFactory("ERC1967Proxy");

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
    config.Validators.validator1address,
    config.Validators.validator2address,
    config.Validators.validator3address,
    config.Validators.validator4address,
    config.Validators.validator5address,
  ];

  const validatorsProxy = await ValidatorsProxy.deploy(
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

  const ValidatorscDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorscDeployed.attach(validatorsProxy.target);

  await bridge.setDependencies(
    claimsProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    validatorsProxy.target
  );

  await claims.setDependencies(bridgeProxy.target, claimsHelper.target, validatorsProxy.target);

  await claimsHelper.setDependencies(claims.target, signedBatches.target);

  await signedBatches.setDependencies(bridge.target, claimsHelper.target, validatorsProxy.target);

  await slots.setDependencies(bridge.target, validatorsProxy.target);

  await validatorsc.setDependencies(bridge.target);

  const chain = {
    id: config.Chain.id,
    chainType: config.Chain.chainType,
    addressMultisig: config.Chain.addressMultisig,
    addressFeePayer: config.Chain.addressFeePayer,
  };

  const validatorsChainData = [
    {
      addr: config.Validators.validator1address,
      data: {
        key: config.Validators.validator1key,
      },
    },
    {
      addr: config.Validators.validator2address,
      data: {
        key: config.Validators.validator2key,
      },
    },
    {
      addr: config.Validators.validator3address,
      data: {
        key: config.Validators.validator3key,
      },
    },
    {
      addr: config.Validators.validator4address,
      data: {
        key: config.Validators.validator4key,
      },
    },
    {
      addr: config.Validators.validator5address,
      data: {
        key: config.Validators.validator5key,
      },
    },
  ];

  await bridge.registerChain(chain, config.Chain.totalSupply, validatorsChainData);

  console.log("BridgeLogic deployed at:", bridgeLogic.target);
  console.log("Bridge deployed at:", bridge.target);
  console.log("---");
  console.log("ClaimsLogic deployed at:", claimsLogic.target);
  console.log("Claims deployed at:", claims.target);
  console.log("---");
  console.log("ClaimsHelperLogic deployed at:", claimsHelperLogic.target);
  console.log("ClaimsHelper deployed at:", claimsHelper.target);
  console.log("---");
  console.log("SignedBatchesLogic deployed at:", signedBatchesLogic.target);
  console.log("SignedBatches deployed at:", signedBatches.target);
  console.log("---");
  console.log("SlotsLogic deployed at:", slotsLogic.target);
  console.log("Slots deployed at:", slots.target);
  console.log("---");
  console.log("ValidatorsLogic deployed at:", validatorscLogic.target);
  console.log("Validators deployed at:", validatorsc.target);
  console.log("---");
  console.log("BridgeLogic owner:", await bridgeLogic.owner());
  console.log("Bridge owner:", await bridge.owner());
  console.log("---");
  console.log("ClaimsLogic maxNumberOfTransactions:", await claimsLogic.maxNumberOfTransactions());
  console.log("Claims maxNumberOfTransactions:", await claims.maxNumberOfTransactions());
  console.log("ClaimsLogic timeoutBlocksNumber:", await claimsLogic.timeoutBlocksNumber());
  console.log("Claims timeoutBlocksNumber:", await claims.timeoutBlocksNumber());
  console.log("---");
  console.log("ValdatorsLogic numberOfValidators:", await validatorscLogic.validatorsCount());
  console.log("Valdators numberOfValidators:", await validatorsc.validatorsCount());
  console.log("---");
  console.log("Validators chain data", await bridge.getValidatorsChainData(chain.id));

  // Proxy Bridge upgrade test
  // const BridgeV2 = await ethers.getContractFactory("BridgeV2");
  // const bridgeV2Logic = await BridgeV2.deploy();

  //empty bytes for second parameter signifies that contract is only being upgraded
  // await bridge.upgradeToAndCall(await bridgeV2Logic.getAddress(), "0x");

  // const BridgeDeployedV2 = await ethers.getContractFactory("BridgeV2");
  // const bridgeV2 = BridgeDeployedV2.attach(bridgeProxy.target);

  //function hello() added in BridgeV2 contract always returns true
  // const result = await bridgeV2.hello();
  // console.log("Hello call BridgeV2", result);
}

main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
