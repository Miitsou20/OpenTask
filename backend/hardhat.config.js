require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
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
  coverage: {
    timeout: 100000,
    allowUnlimitedContractSize: true,
    skipFiles: ['mocks/', 'test/']
  }
};
