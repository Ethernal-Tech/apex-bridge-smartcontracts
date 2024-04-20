import { ethers } from "hardhat";

async function main() {
  //deployment of contract logic
  const BridgeContract = await ethers.getContractFactory("BridgeContract");
  const bridgeContract = await BridgeContract.deploy();

  const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelper = await ClaimsHelper.deploy();

  const ClaimsManager = await ethers.getContractFactory("ClaimsManager");
  const claimsManager = await ClaimsManager.deploy();

  const SignedBatchManager = await ethers.getContractFactory("SignedBatchManager");
  const signedBatchManager = await SignedBatchManager.deploy();

  const SlotsManager = await ethers.getContractFactory("SlotsManager");
  const slotsManager = await SlotsManager.deploy();

  const UTXOsManager = await ethers.getContractFactory("UTXOsManager");
  const utxosManager = await UTXOsManager.deploy();

  const ValidatorsContract = await ethers.getContractFactory("ValidatorsContract");
  const validatorsContract = await ValidatorsContract.deploy();

  // deployment of contract proxy
  const BridgeContractProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsHelperProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ClaimsManagerProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SignedBatchManagerProxy = await ethers.getContractFactory("ERC1967Proxy");
  const SlotsManagerProxy = await ethers.getContractFactory("ERC1967Proxy");
  const UTXOsManagerProxy = await ethers.getContractFactory("ERC1967Proxy");
  const ValidatorsContractProxy = await ethers.getContractFactory("ERC1967Proxy");

  const bridgeContractProxy = await BridgeContractProxy.deploy(
    await bridgeContract.getAddress(),
    BridgeContract.interface.encodeFunctionData("initialize", [])
  );

  const claimsHelperProxy = await ClaimsHelperProxy.deploy(
    await claimsHelper.getAddress(),
    ClaimsHelper.interface.encodeFunctionData("initialize", [])
  );

  const claimsManagerProxy = await ClaimsManagerProxy.deploy(
    await claimsManager.getAddress(),
    ClaimsManager.interface.encodeFunctionData("initialize", [2, 5])
  );

  const signedBatchManagerProxy = await SignedBatchManagerProxy.deploy(
    await signedBatchManager.getAddress(),
    SignedBatchManager.interface.encodeFunctionData("initialize", [])
  );

  const slotsManagerProxy = await SlotsManagerProxy.deploy(
    await slotsManager.getAddress(),
    SlotsManager.interface.encodeFunctionData("initialize", [])
  );

  const utxosManagerProxy = await UTXOsManagerProxy.deploy(
    await utxosManager.getAddress(),
    UTXOsManager.interface.encodeFunctionData("initialize", [])
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
  const BridgeContractDeployed = await ethers.getContractFactory("BridgeContract");
  const bridgeContractDeployed = BridgeContractDeployed.attach(bridgeContractProxy.target);

  const ClaimsHelperDeployed = await ethers.getContractFactory("ClaimsHelper");
  const claimsHelperDeployed = ClaimsHelperDeployed.attach(claimsHelperProxy.target);

  const ClaimsManagerDeployed = await ethers.getContractFactory("ClaimsManager");
  const claimsManagerDeployed = ClaimsManagerDeployed.attach(claimsManagerProxy.target);

  const SignedBatchManagerDeployed = await ethers.getContractFactory("SignedBatchManager");
  const signedBatchManagerDeployed = SignedBatchManagerDeployed.attach(signedBatchManagerProxy.target);

  const SlotsManagerDeployed = await ethers.getContractFactory("SlotsManager");
  const slotsManagerDeployed = SlotsManagerDeployed.attach(slotsManagerProxy.target);

  const UTXOsManagerDeployed = await ethers.getContractFactory("UTXOsManager");
  const utxosManagerDeployed = UTXOsManagerDeployed.attach(utxosManagerProxy.target);

  const ValidatorsContractDeployed = await ethers.getContractFactory("ValidatorsContract");
  const validatorsContractDeployed = ValidatorsContractDeployed.attach(validatorsContractProxy.target);

  await bridgeContractDeployed.setDependencies(
    claimsManagerProxy.target,
    signedBatchManagerProxy.target,
    slotsManagerProxy.target,
    utxosManagerProxy.target,
    validatorsContractProxy.target
  );

  console.log("BridgeContract deployed at:", bridgeContract.target);
  console.log("BridgeContractProxy deployed at:", bridgeContractProxy.target);
  console.log("BridgeContractDeployed deployed at:", bridgeContractDeployed.target);
  console.log("---");
  console.log("BridgeContract owner:", await bridgeContract.owner());
  console.log("BridgeContractDeployed owner:", await bridgeContractDeployed.owner());
  console.log("---");
  console.log("ClaimsManager maxNumberOfTransactions:", await claimsManager.maxNumberOfTransactions());
  console.log("ClaimsManagerDeployed maxNumberOfTransactions:", await claimsManagerDeployed.maxNumberOfTransactions());
  console.log("ClaimsManager timeoutBlocksNumber:", await claimsManager.timeoutBlocksNumber());
  console.log("ClaimsManagerDeployed timeoutBlocksNumber:", await claimsManagerDeployed.timeoutBlocksNumber());
  console.log("---");
  console.log("ValdatorsContract numberOfValidators:", await validatorsContract.validatorsCount());
  console.log("ValdatorsContractDeployed numberOfValidators:", await validatorsContractDeployed.validatorsCount());

  //await bridgeContractDeployed.console.log(`Bridge deployed to ${bridgeContract.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
