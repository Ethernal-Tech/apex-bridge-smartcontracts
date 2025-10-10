import { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

const config: HardhatUserConfig = {
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
  plugins: [hardhatToolboxMochaEthers, hardhatNetworkHelpers],
};

export default config;
