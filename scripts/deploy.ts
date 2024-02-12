import { ethers } from "hardhat";

async function main() {

  const bridgeContract = await ethers.deployContract("BridgeContract");

  await bridgeContract.waitForDeployment();

  console.log(
    `BridgeContract deployed to ${bridgeContract.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
