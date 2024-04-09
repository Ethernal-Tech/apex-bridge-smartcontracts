import { ethers } from "hardhat";
// import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

async function main() {
  const [owner] = await ethers.getSigners();

  const BridgeContract = await ethers.getContractFactory("BridgeContract");
  const bridgeContract = await BridgeContract.deploy();

  console.log(`BridgeContract deployed to ${bridgeContract.target}`);

  //web3.utils.sha3('initialize()').substring(0,10) -> 0x6e05c269

  const ProxyBridgeContract = await ethers.getContractFactory("ERC1967Proxy");
  console.log("prosao");
  const proxyBridgeContract = await ProxyBridgeContract.deploy(bridgeContract.target, "0xd9dee844");
  console.log("prosao");

  console.log(`ProxyBridgeContract deployed to ${proxyBridgeContract.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
