import { task } from "hardhat/config";
import chalk from "chalk";

task("size-all", "Print compiled sizes of all contracts")
  .setAction(async (_, hre) => {
    await hre.run("compile");

    console.log(chalk.bold("\nContract Size Report"));
    console.log(chalk.gray("------------------------------------------"));

    const artifactFiles = await hre.artifacts.getAllFullyQualifiedNames();

    const LIMIT = 24576;
    for (const fqName of artifactFiles) {
      const artifact = await hre.artifacts.readArtifact(fqName.split(":")[1]);
      const contractName = artifact.contractName;
      const size = (artifact.deployedBytecode.length - 2) / 2;

      const sizeKB = (size / 1024).toFixed(2);
      const color =
        size > LIMIT ? chalk.redBright : chalk.greenBright;

      console.log(
        `${contractName.padEnd(30)} ${color(`${size} bytes (${sizeKB} KB)`)}`
      );
    }

    console.log(chalk.gray("------------------------------------------"));
    console.log(chalk.bold("Limit: 24,576 bytes (24 KB)\n"));
  });