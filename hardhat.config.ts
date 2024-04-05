import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require("@nomicfoundation/hardhat-ethers");

// const { ProxyAgent, setGlobalDispatcher } = require("undici")
// const proxyAgent = new ProxyAgent("http://ftn.proxy:8080")
// setGlobalDispatcher(proxyAgent)

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 55,
      },
    },
  },
};

export default config;
