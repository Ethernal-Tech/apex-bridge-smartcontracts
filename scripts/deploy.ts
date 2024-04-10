import { ethers } from "hardhat";
// import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

async function main() {
  const [owner] = await ethers.getSigners();

  const BridgeContract = await ethers.getContractFactory("BridgeContract");
  const bridgeContract = await BridgeContract.deploy();

  console.log(`BridgeContract deployed to ${bridgeContract.target}`);

  //_data for ERC1967Proxy constructor
  // function selector + arguments
  // web3.utils.sha3('initialize(uint16,uint8)').substring(0, 10)
  // or through remix
  // or through solidity
  // function getSelector(string calldata _func) public pure returns (bytes4) {
  //   return bytes4(keccak256(bytes(_func)));
  // }
  // 1 - 0000000000000000000000000000000000000000000000000000000000000001

  const ProxyBridgeContract = await ethers.getContractFactory("ERC1967Proxy");
  const proxyBridgeContract = await ProxyBridgeContract.deploy(
    bridgeContract.target,
    "0xd9dee84400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
  );

  console.log(`ProxyBridgeContract deployed to ${proxyBridgeContract.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
