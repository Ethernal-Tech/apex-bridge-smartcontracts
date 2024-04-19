import { ethers } from "hardhat";

async function main() {
  const bridge = await ethers.deployContract("Bridge");

  await bridge.waitForDeployment();

  console.log(`Bridge deployed to ${bridge.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
