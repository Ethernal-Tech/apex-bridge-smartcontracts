import { ethers } from "hardhat";

async function main() {
  //deployment of contract logic
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy();

  const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelper = await ClaimsHelper.deploy();

  const Claims = await ethers.getContractFactory("Claims");
  const claims = await Claims.deploy();

  const SignedBatches = await ethers.getContractFactory("SignedBatches");
  const signedBatches = await SignedBatches.deploy();

  const Slots = await ethers.getContractFactory("Slots");
  const slots = await Slots.deploy();

  const UTXOsc = await ethers.getContractFactory("UTXOsc");
  const utxosc = await UTXOsc.deploy();

  const ValidatorsContract = await ethers.getContractFactory("ValidatorsContract");
  const validatorsContract = await ValidatorsContract.deploy();

  // deployment of contract proxy
  const BridgeProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SignedBatchesProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SlotsProxy = await ethers.getContractFactory("ERC1967Proxy");
  const UTXOscProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorsContractProxy = await ethers.getContractFactory("ERC1967Proxy");

  const bridgeProxy = await BridgeProxy.deploy(
    await bridge.getAddress(),
    Bridge.interface.encodeFunctionData("initialize", [])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelper.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [])
  );

  const claimsProxy = await ClaimsProxy.deploy(
    await claims.getAddress(),
    Claims.interface.encodeFunctionData("initialize", [2, 5])
  );

  const signedBatchesProxy = await SignedBatchesProxy.deploy(
    await signedBatches.getAddress(),
    SignedBatches.interface.encodeFunctionData("initialize", [])
  );

  const slotsProxy = await SlotsProxy.deploy(
    await slots.getAddress(),
    Slots.interface.encodeFunctionData("initialize", [])
  );

  const utxoscProxy = await UTXOscProxy.deploy(
    await utxosc.getAddress(),
    UTXOsc.interface.encodeFunctionData("initialize", [])
  );

  const [validator1, validator2, validator3, validator4, validator5] = await ethers.getSigners();
  const validators = [
    validator1.address,
    validator2.address,
    validator3.address,
    validator4.address,
    validator5.address,
  ];

  const validatorsContractProxy = await ValidatorsContractProxy.deploy(
    await validatorsContract.getAddress(),
    ValidatorsContract.interface.encodeFunctionData("initialize", [validators])
  );

  //casting proxy contracts to contract logic
  const BridgeDeployed = await ethers.getContractFactory("Bridge");
  const bridgeDeployed = BridgeDeployed.attach(bridgeProxy.target);

  const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelperDeployed = ClaimsHelperDeployed.attach(claimsHelperProxy.target);

  const ClaimsDeployed = await ethers.getContractFactory("Claims");
  const claimsDeployed = ClaimsDeployed.attach(claimsProxy.target);

  const SignedBatchesDeployed = await ethers.getContractFactory("SignedBatches");
  const signedBatchesDeployed = SignedBatchesDeployed.attach(signedBatchesProxy.target);

  const SlotsDeployed = await ethers.getContractFactory("Slots");
  const slotsDeployed = SlotsDeployed.attach(slotsProxy.target);

  const UTXOscDeployed = await ethers.getContractFactory("UTXOsc");
  const utxoscDeployed = UTXOscDeployed.attach(utxoscProxy.target);

  const ValidatorsContractDeployed = await ethers.getContractFactory("ValidatorsContract");
  const validatorsContractDeployed = ValidatorsContractDeployed.attach(validatorsContractProxy.target);

  await bridgeDeployed.setDependencies(
    claimsProxy.target,
    signedBatchesProxy.target,
    slotsProxy.target,
    utxoscProxy.target,
    validatorsContractProxy.target
  );

  console.log("Bridge deployed at:", bridge.target);
  console.log("BridgeProxy deployed at:", bridgeProxy.target);
  console.log("BridgeDeployed deployed at:", bridgeDeployed.target);
  console.log("---");
  console.log("Bridge owner:", await bridge.owner());
  console.log("BridgeDeployed owner:", await bridgeDeployed.owner());
  console.log("---");
  console.log("Claims maxNumberOfTransactions:", await claims.maxNumberOfTransactions());
  console.log("ClaimsDeployed maxNumberOfTransactions:", await claimsDeployed.maxNumberOfTransactions());
  console.log("Claims timeoutBlocksNumber:", await claims.timeoutBlocksNumber());
  console.log("ClaimsDeployed timeoutBlocksNumber:", await claimsDeployed.timeoutBlocksNumber());
  console.log("---");
  console.log("ValdatorsContract numberOfValidators:", await validatorsContract.validatorsCount());
  console.log("ValdatorsContractDeployed numberOfValidators:", await validatorsContractDeployed.validatorsCount());

  //await bridgeDeployed.console.log(`Bridge deployed to ${bridge.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
