import { HardhatUserConfig } from "hardhat/config";
import "dotenv/config"
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";

const SEPOLIA_URL = process.env.SEPOLIA_URL as string;
const PRIVATE_KEY = process.env.PRIVATE_KEY as string;

console.log("SEPOLIA_URL: ", SEPOLIA_URL);

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
      url: SEPOLIA_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
