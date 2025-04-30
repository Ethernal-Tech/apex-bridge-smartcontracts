import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
// import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
  },
};

module.exports = {
  networks: {
    hardhat: {},
    // blade: {
    //   url: process.env.BLADE_URL,
    //   accounts: [process.env.BLADE_PRIVATE_KEY],
    //   gasPrice: 35000000000,
    // },
  },
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
};

export default config;
