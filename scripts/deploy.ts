const { ethers } = require("ethers");
const { JsonRpcProvider } = require("ethers");
const config = require("./config.json");
const adminJson = require("../artifacts/contracts/Admin.sol/Admin.json");
const bridgeJson = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const claimsJson = require("../artifacts/contracts/Claims.sol/Claims.json");
const claimsHelperJson = require("../artifacts/contracts/ClaimsHelper.sol/ClaimsHelper.json");
const signedBatchesJson = require("../artifacts/contracts/SignedBatches.sol/SignedBatches.json");
const slotsJson = require("../artifacts/contracts/Slots.sol/Slots.json");
const validatorsJson = require("../artifacts/contracts/Validators.sol/Validators.json");
const ERC1967ProxyJson = require("../artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");

async function main() {
  const provider = new JsonRpcProvider(config.RPC.url);
  const wallet = new ethers.Wallet(config.RPC.key, provider);

  console.log("--- Deploying the Logic Contracts");
  const adminFactory = new ethers.ContractFactory(adminJson.abi, adminJson.bytecode, wallet);
  const adminLogic = await adminFactory.deploy();
  await adminLogic.waitForDeployment();
  console.log("Admin logic", adminLogic.target);

  const bridgeFactory = new ethers.ContractFactory(bridgeJson.abi, bridgeJson.bytecode, wallet);
  const bridgeLogic = await bridgeFactory.deploy();
  await bridgeLogic.waitForDeployment();
  console.log("Bridge logic", bridgeLogic.target);

  const claimsFactory = new ethers.ContractFactory(claimsJson.abi, claimsJson.bytecode, wallet);
  const claimsLogic = await claimsFactory.deploy();
  await claimsLogic.waitForDeployment();
  console.log("Claims logic", claimsLogic.target);

  const claimsHelperFactory = new ethers.ContractFactory(claimsHelperJson.abi, claimsHelperJson.bytecode, wallet);
  const claimsHelperLogic = await claimsHelperFactory.deploy();
  await claimsHelperLogic.waitForDeployment();
  console.log("ClaimsHelper logic", claimsHelperLogic.target);

  const signedBatchesFactory = new ethers.ContractFactory(signedBatchesJson.abi, signedBatchesJson.bytecode, wallet);
  const signedBatchesLogic = await signedBatchesFactory.deploy();
  await signedBatchesLogic.waitForDeployment();
  console.log("SignedBatches logic", signedBatchesLogic.target);

  const slotsFactory = new ethers.ContractFactory(slotsJson.abi, slotsJson.bytecode, wallet);
  const slotsLogic = await slotsFactory.deploy();
  await slotsLogic.waitForDeployment();
  console.log("Slots logic", slotsLogic.target);

  const validatorsFactory = new ethers.ContractFactory(validatorsJson.abi, validatorsJson.bytecode, wallet);
  const validatorsLogic = await validatorsFactory.deploy();
  await validatorsLogic.waitForDeployment();
  console.log("Validators logic", validatorsLogic.target);

  console.log("--- Deploying the Proxy Contracts");
  const owner = config.Owner.address;
  let initDataOwnerUpgradeAdmin = bridgeLogic.interface.encodeFunctionData("initialize", [owner, owner]);

  const ProxyFactory = new ethers.ContractFactory(ERC1967ProxyJson.abi, ERC1967ProxyJson.bytecode, wallet);

  const adminProxyContract = await ProxyFactory.deploy(adminLogic.target, initDataOwnerUpgradeAdmin);
  await adminProxyContract.waitForDeployment();

  console.log(`Admin Proxy contract deployed at: ${adminProxyContract.target}`);

  const bridgeProxyContract = await ProxyFactory.deploy(bridgeLogic.target, initDataOwnerUpgradeAdmin);
  await bridgeProxyContract.waitForDeployment();

  console.log(`Bridge Proxy contract deployed at: ${bridgeProxyContract.target}`);

  const initDataClaims = claimsLogic.interface.encodeFunctionData("initialize", [owner, owner, 2, 5]);

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
    owner,
    owner,
    validatorsAddresses,
  ]);

  const validatorsProxyContract = await ProxyFactory.deploy(validatorsLogic.target, initDataValidators);
  await validatorsProxyContract.waitForDeployment();

  console.log(`Validators Proxy contract deployed at: ${validatorsProxyContract.target}`);

  console.log("--- Setting dependencies");

  const adminBridge = new ethers.Contract(adminProxyContract.target, adminJson.abi, wallet);

  let tx = await adminBridge.setDependencies(claimsProxyContract.target);

  await tx.wait();
  console.log("Admin setDependencies done");

  const proxyBridge = new ethers.Contract(bridgeProxyContract.target, bridgeJson.abi, wallet);

  tx = await proxyBridge.setDependencies(
    claimsProxyContract.target,
    signedBatchesProxyContract.target,
    slotsProxyContract.target,
    validatorsProxyContract.target
  );

  await tx.wait();
  console.log("Bridge setDependencies done");

  const proxyClaims = new ethers.Contract(claimsProxyContract.target, claimsJson.abi, wallet);

  tx = await proxyClaims.setDependencies(
    bridgeProxyContract.target,
    claimsHelperProxyContract.target,
    validatorsProxyContract.target,
    adminProxyContract.target
  );

  await tx.wait();
  console.log("Claims setDependencies done");

  const proxyClaimsHelper = new ethers.Contract(claimsHelperProxyContract.target, claimsHelperJson.abi, wallet);

  tx = await proxyClaimsHelper.setDependencies(claimsProxyContract.target, signedBatchesProxyContract.target);

  await tx.wait();
  console.log("ClaimsHelper setDependencies done");

  const proxySignedBatches = new ethers.Contract(signedBatchesProxyContract.target, signedBatchesJson.abi, wallet);

  tx = await proxySignedBatches.setDependencies(
    bridgeProxyContract.target,
    claimsHelperProxyContract.target,
    validatorsProxyContract.target
  );

  await tx.wait();
  console.log("SignedBatches setDependencies done");

  const proxySlots = new ethers.Contract(slotsProxyContract.target, slotsJson.abi, wallet);

  tx = await proxySlots.setDependencies(bridgeProxyContract.target, validatorsProxyContract.target);

  await tx.wait();
  console.log("Slots setDependencies done");

  const proxyValidators = new ethers.Contract(validatorsProxyContract.target, validatorsJson.abi, wallet);

  tx = await proxyValidators.setDependencies(bridgeProxyContract.target);

  await tx.wait();
  console.log("Validators setDependencies done");

  // const chain = {
  //   id: config.Chain.id,
  //   chainType: config.Chain.chainType,
  //   addressMultisig: config.Chain.addressMultisig,
  //   addressFeePayer: config.Chain.addressFeePayer,
  // };

  // const validatorsChainData = [
  //   {
  //     addr: config.Validators.validator1address,
  //     data: {
  //       key: [1n, 1n, 1n, 1n],
  //     },
  //     keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  //     keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  //   },
  //   {
  //     addr: config.Validators.validator2address,
  //     data: {
  //       key: [2n, 2n, 2n, 2n],
  //     },
  //   },
  //   {
  //     addr: config.Validators.validator3address,
  //     data: {
  //       key: [3n, 3n, 3n, 3n],
  //     },
  //     keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  //     keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  //   },
  //   {
  //     addr: config.Validators.validator4address,
  //     data: {
  //       key: [4n, 4n, 4n, 4n],
  //     },
  //     keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  //     keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  //   },
  //   {
  //     addr: config.Validators.validator5address,
  //     data: {
  //       key: [5n, 5n, 5n, 5n],
  //     },
  //     keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  //     keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  //   },
  // ];

  // tx = await proxyBridge.registerChain(chain, config.Chain.totalSupply, validatorsChainData);

  // await tx.wait();
  // console.log("Chain registered");

  // //after this step, gateway contract should be deployed on the other chain
  // //and the address of the gateway contract should be added to the bridge contract

  // tx = await proxyBridge.setChainAdditionalData(
  //   config.Chain.id,
  //   config.AdditionalData.addressMultisig,
  //   config.AdditionalData.addressFeePayer,
  //   { gasPrice: gasPrice * BigInt(8), nonce: nonce + 20 }
  // );

  // // receipt = await tx.wait();
  // console.log("Chain additional data set");

  // console.log("---");
  // console.log("Validators chain data", await proxyBridge.getValidatorsChainData(chain.id));

  // Proxy Bridge upgrade test
  const BridgeV2 = await ethers.getContractFactory("BridgeV2");
  const bridgeV2Logic = await BridgeV2.deploy();

  //empty bytes for second parameter signifies that contract is only being upgraded
  await proxyBridge.upgradeToAndCall(await bridgeV2Logic.getAddress(), "0x");

  const BridgeDeployedV2 = await ethers.getContractFactory("BridgeV2");
  const bridgeV2 = BridgeDeployedV2.attach(bridgeProxyContract.target);

  //function hello() added in BridgeV2 contract always returns true
  const result = await bridgeV2.hello();
  console.log("Hello call BridgeV2", result);
}

main();
