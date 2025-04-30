const { ethers, JsonRpcProvider } = require("ethers");
const config = require("./config.json");
const adminJson = require("../artifacts/contracts/Admin.sol/Admin.json");
const adminV2Json = require("../artifacts/contracts/AdminV2.sol/AdminV2.json");
const bridgeJson = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const bridgeV2Json = require("../artifacts/contracts/BridgeV2.sol/BridgeV2.json");
const claimsJson = require("../artifacts/contracts/Claims.sol/Claims.json");
const claimsV2Json = require("../artifacts/contracts/ClaimsV2.sol/ClaimsV2.json");
const claimsHelperJson = require("../artifacts/contracts/ClaimsHelper.sol/ClaimsHelper.json");
const claimsHelperV2Json = require("../artifacts/contracts/ClaimsHelperV2.sol/ClaimsHelperV2.json");
const signedBatchesJson = require("../artifacts/contracts/SignedBatches.sol/SignedBatches.json");
const signedBatchesV2Json = require("../artifacts/contracts/SignedBatchesV2.sol/SignedBatchesV2.json");
const slotsJson = require("../artifacts/contracts/Slots.sol/Slots.json");
const slotsV2Json = require("../artifacts/contracts/SlotsV2.sol/SlotsV2.json");
const validatorsJson = require("../artifacts/contracts/Validators.sol/Validators.json");
const validatorsV2Json = require("../artifacts/contracts/ValidatorsV2.sol/ValidatorsV2.json");
const ERC1967ProxyJson = require("../artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");

async function main() {
  if (process.argv.slice(2).length < 2) {
    console.log("Please provide 2 arguments: RPC_URL, PRIVATE_KEY");
    process.exit(1);
  }

  const RPC_URL = process.argv[2];
  const PRIVATE_KEY = process.argv[3];

  const provider = new JsonRpcProvider(RPC_URL);
  const owner = new ethers.Wallet(PRIVATE_KEY, provider);
  const ownerAddress = await owner.getAddress();

  console.log("--- Deploying the Logic Contracts");
  const adminFactory = new ethers.ContractFactory(adminJson.abi, adminJson.bytecode, owner);
  const adminLogic = await adminFactory.deploy();
  await adminLogic.waitForDeployment();
  console.log("Admin logic", adminLogic.target);

  const bridgeFactory = new ethers.ContractFactory(bridgeJson.abi, bridgeJson.bytecode, owner);
  const bridgeLogic = await bridgeFactory.deploy();
  await bridgeLogic.waitForDeployment();
  console.log("Bridge logic", bridgeLogic.target);

  const claimsFactory = new ethers.ContractFactory(claimsJson.abi, claimsJson.bytecode, owner);
  const claimsLogic = await claimsFactory.deploy();
  await claimsLogic.waitForDeployment();
  console.log("Claims logic", claimsLogic.target);

  const claimsHelperFactory = new ethers.ContractFactory(claimsHelperJson.abi, claimsHelperJson.bytecode, owner);
  const claimsHelperLogic = await claimsHelperFactory.deploy();
  await claimsHelperLogic.waitForDeployment();
  console.log("ClaimsHelper logic", claimsHelperLogic.target);

  const signedBatchesFactory = new ethers.ContractFactory(signedBatchesJson.abi, signedBatchesJson.bytecode, owner);
  const signedBatchesLogic = await signedBatchesFactory.deploy();
  await signedBatchesLogic.waitForDeployment();
  console.log("SignedBatches logic", signedBatchesLogic.target);

  const slotsFactory = new ethers.ContractFactory(slotsJson.abi, slotsJson.bytecode, owner);
  const slotsLogic = await slotsFactory.deploy();
  await slotsLogic.waitForDeployment();
  console.log("Slots logic", slotsLogic.target);

  const validatorsFactory = new ethers.ContractFactory(validatorsJson.abi, validatorsJson.bytecode, owner);
  const validatorsLogic = await validatorsFactory.deploy();
  await validatorsLogic.waitForDeployment();
  console.log("Validators logic", validatorsLogic.target);

  console.log("--- Deploying the Proxy Contracts");
  let initDataOwnerUpgradeAdmin = bridgeLogic.interface.encodeFunctionData("initialize", [ownerAddress, ownerAddress]);

  const ProxyFactory = new ethers.ContractFactory(ERC1967ProxyJson.abi, ERC1967ProxyJson.bytecode, owner);

  const adminProxyContract = await ProxyFactory.deploy(adminLogic.target, initDataOwnerUpgradeAdmin);
  await adminProxyContract.waitForDeployment();

  console.log(`Admin Proxy contract deployed at: ${adminProxyContract.target}`);

  const bridgeProxyContract = await ProxyFactory.deploy(bridgeLogic.target, initDataOwnerUpgradeAdmin);
  await bridgeProxyContract.waitForDeployment();

  console.log(`Bridge Proxy contract deployed at: ${bridgeProxyContract.target}`);

  const initDataClaims = claimsLogic.interface.encodeFunctionData("initialize", [ownerAddress, ownerAddress, 2, 5]);

  const claimsProxyContract = await ProxyFactory.deploy(claimsLogic.target, initDataClaims);
  await claimsProxyContract.waitForDeployment();

  console.log(`Claims Proxy contract deployed at: ${claimsProxyContract.target}`);

  const claimsHelperProxyContract = await ProxyFactory.deploy(claimsHelperLogic.target, initDataOwnerUpgradeAdmin);
  await claimsHelperProxyContract.waitForDeployment();

  console.log(`ClaimsHelper Proxy contract deployed at: ${claimsHelperProxyContract.target}`);

  const signedBatchesProxyContract = await ProxyFactory.deploy(signedBatchesLogic.target, initDataOwnerUpgradeAdmin);
  await signedBatchesProxyContract.waitForDeployment();

  console.log(`SignedBatches Proxy contract deployed at: ${signedBatchesProxyContract.target}`);

  const slotsProxyContract = await ProxyFactory.deploy(slotsLogic.target, initDataOwnerUpgradeAdmin);
  await slotsProxyContract.waitForDeployment();

  console.log(`Slots Proxy contract deployed at: ${slotsProxyContract.target}`);

  const validatorsAddresses = [
    config.Validators.validator1address,
    config.Validators.validator2address,
    config.Validators.validator3address,
    config.Validators.validator4address,
    config.Validators.validator5address,
  ];

  const initDataValidators = validatorsLogic.interface.encodeFunctionData("initialize", [
    ownerAddress,
    ownerAddress,
    validatorsAddresses,
  ]);

  const validatorsProxyContract = await ProxyFactory.deploy(validatorsLogic.target, initDataValidators);
  await validatorsProxyContract.waitForDeployment();

  console.log(`Validators Proxy contract deployed at: ${validatorsProxyContract.target}`);

  console.log("--- Upgrading smart contracts");
  // Proxy upgrade test
  // Should create a copy of Bridge -> BridgeV2 smart contract with new version number

  const proxyAdmin = new ethers.Contract(adminProxyContract.target, bridgeJson.abi, owner);
  const proxyBridge = new ethers.Contract(bridgeProxyContract.target, bridgeJson.abi, owner);
  const proxyClaims = new ethers.Contract(claimsProxyContract.target, claimsJson.abi, owner);
  const proxyClaimsHelper = new ethers.Contract(claimsHelperProxyContract.target, claimsHelperJson.abi, owner);
  const proxySignedBatches = new ethers.Contract(signedBatchesProxyContract.target, signedBatchesJson.abi, owner);
  const proxySlots = new ethers.Contract(slotsProxyContract.target, slotsJson.abi, owner);
  const proxyValidators = new ethers.Contract(validatorsProxyContract.target, validatorsJson.abi, owner);

  let versionBefore = await proxyAdmin.version();
  console.log("Admin version before upgrade", versionBefore);
  let implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  let storage = await provider.getStorage(proxyAdmin, implSlot);
  let implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Admin implementation address before:", implementationAddress);

  const adminV2Factory = new ethers.ContractFactory(adminV2Json.abi, adminV2Json.bytecode, owner);
  const adminV2Logic = await adminV2Factory.deploy();
  await adminV2Logic.waitForDeployment();
  console.log("Admin V2 logic", adminV2Logic.target);

  let newImplementationAddress = await adminV2Logic.getAddress();
  let upgradeTx = await proxyAdmin.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxyAdmin2 = new ethers.Contract(adminProxyContract.target, adminV2Json.abi, owner);
  let versionAfter = await proxyAdmin2.version();
  console.log("Admin version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyAdmin2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Admin implementation address after", implementationAddress);

  ///
  versionBefore = await proxyBridge.version();
  console.log("Bridge version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyBridge, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Bridge implementation address before:", implementationAddress);

  const bridgeV2Factory = new ethers.ContractFactory(bridgeV2Json.abi, bridgeV2Json.bytecode, owner);
  const bridgeV2Logic = await bridgeV2Factory.deploy();
  await bridgeV2Logic.waitForDeployment();
  console.log("Bridge V2 logic", bridgeV2Logic.target);

  newImplementationAddress = await bridgeV2Logic.getAddress();
  upgradeTx = await proxyBridge.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxyBridge2 = new ethers.Contract(bridgeProxyContract.target, bridgeV2Json.abi, owner);
  versionAfter = await proxyBridge2.version();
  console.log("Bridge version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyBridge2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Bridge implementation address after", implementationAddress);

  ////

  versionBefore = await proxyClaims.version();
  console.log("Claims version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyClaims, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Claims implementation address before:", implementationAddress);

  const claimsV2Factory = new ethers.ContractFactory(claimsV2Json.abi, claimsV2Json.bytecode, owner);
  const claimsV2Logic = await claimsV2Factory.deploy();
  await claimsV2Logic.waitForDeployment();
  console.log("Claims V2 logic", claimsV2Logic.target);

  newImplementationAddress = await claimsV2Logic.getAddress();
  upgradeTx = await proxyClaims.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxyClaims2 = new ethers.Contract(claimsProxyContract.target, claimsV2Json.abi, owner);
  versionAfter = await proxyClaims2.version();
  console.log("Claims version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyClaims2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Claims implementation address after", implementationAddress);

  ////

  versionBefore = await proxyClaimsHelper.version();
  console.log("ClaimsHelper version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyClaimsHelper, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("ClaimsHelper implementation address before:", implementationAddress);

  const claimsHelperV2Factory = new ethers.ContractFactory(claimsHelperV2Json.abi, claimsHelperV2Json.bytecode, owner);
  const claimsHelperV2Logic = await claimsHelperV2Factory.deploy();
  await claimsHelperV2Logic.waitForDeployment();
  console.log("ClaimsHelper V2 logic", claimsHelperV2Logic.target);

  newImplementationAddress = await claimsHelperV2Logic.getAddress();
  upgradeTx = await proxyClaimsHelper.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxyClaimsHelper2 = new ethers.Contract(claimsHelperProxyContract.target, claimsHelperV2Json.abi, owner);
  versionAfter = await proxyClaimsHelper2.version();
  console.log("ClaimsHelper version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyClaimsHelper2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("ClaimsHelper implementation address after", implementationAddress);

  ////

  versionBefore = await proxySignedBatches.version();
  console.log("SignedBatches version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxySignedBatches, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("SignedBatches implementation address before:", implementationAddress);

  const signedBatchesV2Factory = new ethers.ContractFactory(
    signedBatchesV2Json.abi,
    signedBatchesV2Json.bytecode,
    owner
  );
  const signedBatchesV2Logic = await signedBatchesV2Factory.deploy();
  await signedBatchesV2Logic.waitForDeployment();
  console.log("SignedBatches V2 logic", signedBatchesV2Logic.target);

  newImplementationAddress = await signedBatchesV2Logic.getAddress();
  upgradeTx = await proxySignedBatches.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxySignedBatches2 = new ethers.Contract(signedBatchesProxyContract.target, signedBatchesV2Json.abi, owner);
  versionAfter = await proxySignedBatches2.version();
  console.log("SignedBatches version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxySignedBatches2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("SignedBatches implementation address after", implementationAddress);

  ////

  versionBefore = await proxySlots.version();
  console.log("Slots version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxySlots, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Slots implementation address before:", implementationAddress);

  const slotsV2Factory = new ethers.ContractFactory(slotsV2Json.abi, slotsV2Json.bytecode, owner);
  const slotsV2Logic = await slotsV2Factory.deploy();
  await slotsV2Logic.waitForDeployment();
  console.log("Slots V2 logic", slotsV2Logic.target);

  newImplementationAddress = await slotsV2Logic.getAddress();
  upgradeTx = await proxySlots.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxySlots2 = new ethers.Contract(slotsProxyContract.target, slotsV2Json.abi, owner);
  versionAfter = await proxySlots.version();
  console.log("Slots version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxySlots2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Slots implementation address after", implementationAddress);

  ////

  versionBefore = await proxyValidators.version();
  console.log("Validators version before upgrade", versionBefore);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyValidators, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));

  console.log("Validators implementation address before:", implementationAddress);

  const validatorsV2Factory = new ethers.ContractFactory(validatorsV2Json.abi, validatorsV2Json.bytecode, owner);
  const validatorsV2Logic = await validatorsV2Factory.deploy();
  await validatorsV2Logic.waitForDeployment();
  console.log("Validators V2 logic", validatorsV2Logic.target);

  newImplementationAddress = await validatorsV2Logic.getAddress();
  upgradeTx = await proxyValidators.connect(owner).upgradeTo(newImplementationAddress);
  await upgradeTx.wait();

  const proxyValidators2 = new ethers.Contract(validatorsProxyContract.target, validatorsV2Json.abi, owner);
  versionAfter = await proxyValidators.version();
  console.log("Validators version after upgrade", versionAfter);
  implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  storage = await provider.getStorage(proxyValidators2, implSlot);
  implementationAddress = ethers.getAddress("0x" + storage.slice(-40));
  console.log("Validators implementation address after", implementationAddress);
}

main();
