require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require('dotenv').config();
require("hardhat-docgen");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      }
    }
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gasPrice: "auto",
      maxFeePerGas: "auto",
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    hardhat: {
      accounts: {
        count: 30
      },
      mining: {
        auto: true,
        interval: 0
      }
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  coverage: {
    timeout: 100000,
    allowUnlimitedContractSize: true,
    skipFiles: ['mocks/', 'test/']
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
    only: ['TaskMarketplace.sol', 'TaskEscrow.sol', 'Treasury.sol', 'SoulBoundTokenRole.sol', 'SoulBoundAchievement.sol', 'SoulBoundRedflag.sol']
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: 'ETH',
    L1Etherscan: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    outputFile: "gas-report.txt",
    noColors: true,
    excludeContracts: ['MockReceiver'],
    showTimeSpent: true
  },
};
