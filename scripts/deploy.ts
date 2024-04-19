import { ethers } from "hardhat";

async function main() {
  const bridge = await ethers.deployContract("Bridge");
  const claimsHelper = await ethers.deployContract("ClaimsHelper");
  const claims = await ethers.deployContract("Claims");
  const signedBatchManager = await ethers.deployContract("SignedBatchManager");
  const slotsManager = await ethers.deployContract("SlotsManager");
  const utxosManager = await ethers.deployContract("UTOXsManager");
  const validatorsContract = await ethers.deployContract("ValidatorsContract");

  console.log(`Bridge deployed to ${bridge.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});
