import { ethers } from "hardhat";

async function main() {
  const BridgeContract = await ethers.getContractFactory("BridgeContract");
  const ClaimsHelper = await ethers.getContractFactory("ClaimsHelper");
  const ClaimsManager = await ethers.getContractFactory("ClaimsManager");
  const SignedBatchManager = await ethers.getContractFactory("SignedBatchManager");
  const SlotsManager = await ethers.getContractFactory("SlotsManager");
  const UTXOsManager = await ethers.getContractFactory("UTOXsManager");
  const ValidatorsContract = await ethers.getContractFactory("ValidatorsContract");

  const bridgeContract = await BridgeContract.deploy();
  const claimsHelper = await ClaimsHelper.deploy();
  const claimsManager = await ClaimsManager.deploy();
  const signedBatchManager = await SignedBatchManager.deploy();
  const slotsManager = await SlotsManager.deploy();
  const utxosManager = await UTXOsManager.deploy();
  const validatorsContract = await ValidatorsContract.deploy();

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
    ClaimsManager.interface.encodeFunctionData("initialize", [])
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

  const validatorsContractProxy = await ValidatorsContractProxy.deploy(
    await validatorsContract.getAddress(),
    ValidatorsContract.interface.encodeFunctionData("initialize", [])
  );

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

  //await bridgeContractDeployed.console.log(`Bridge deployed to ${bridgeContract.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
