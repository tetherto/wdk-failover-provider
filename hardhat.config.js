/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainId: 1
    }
  }
}
