import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatIgnitionEthersPlugin from "@nomicfoundation/hardhat-ignition-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, HardhatIgnitionEthersPlugin],
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      viaIR: true,
    },
  },
});
