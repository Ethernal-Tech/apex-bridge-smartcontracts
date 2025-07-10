import { ethers } from "hardhat";

async function main() {
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

  const utxoscProxy = await UTXOscProxy.deploy(
    await utxoscLogic.getAddress(),
    UTXOsc.interface.encodeFunctionData("initialize", [])
  );

  const [validator1, validator2, validator3, validator4, validator5] = await ethers.getSigners();
  const validatorsAddresses = [
    validator1.address,
    validator2.address,
    validator3.address,
    validator4.address,
    validator5.address,
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

  const UTXOscDeployed = await ethers.getContractFactory("UTXOsc");
  const utxosc = UTXOscDeployed.attach(utxoscProxy.target);

  const ValidatorscDeployed = await ethers.getContractFactory("Validators");
  const validatorsc = ValidatorscDeployed.attach(validatorsProxy.target);

  await bridge.setDependencies(
    claimsProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    utxoscProxy.target,
    validatorsProxy.target
  );

  console.log("BridgeLogic deployed at:", bridgeLogic.target);
  console.log("BridgeProxy deployed at:", bridgeProxy.target);
  console.log("Bridge deployed at:", bridge.target);
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
