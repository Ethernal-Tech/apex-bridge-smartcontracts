import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";
import hardhatPlugin from "@nomicfoundation/hardhat-mocha";
import hardhatChaiMatchersPlugin from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatNetworkHelpersPlugin from "@nomicfoundation/hardhat-network-helpers";

import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [
    hardhatToolboxMochaEthersPlugin,
    hardhatEthersPlugin,
    hardhatTypechain,
    hardhatPlugin,
    hardhatChaiMatchersPlugin,
    hardhatNetworkHelpersPlugin,
  ],
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
});
