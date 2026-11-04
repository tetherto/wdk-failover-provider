import FailoverProvider from '@tetherto/wdk-failover-provider'

import { JsonRpcProvider, BrowserProvider, parseEther, Wallet, ZeroAddress } from 'ethers'

import { beforeAll, describe, expect, test } from '@jest/globals'

/**
 * @typedef {import("ethers").AbstractProvider} AbstractProvider
 */

const window = {
  ethereum: {
    request: async ({ method }) => {
      if (method === 'eth_chainId') return 1
      throw new Error('Provider disconnected')
    },
  },
}

const RPC_URL = 'http://127.0.0.1:8545'

const NETWORK = { name: 'mainnet', chainId: 1 }

describe('@tetherto/wdk-failover-provider', () => {
  beforeAll(async () => {
    await new JsonRpcProvider(RPC_URL, NETWORK, { staticNetwork: true }).send('hardhat_mine', ['0x1'])
  })

  test('should accept polymorphism', async () => {
    /**
     * @type {AbstractProvider}
     */
    const provider = new FailoverProvider()
      .addProvider(new BrowserProvider(window.ethereum))
      .addProvider(new JsonRpcProvider(RPC_URL, NETWORK))
      .initialize()

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).toBe(1)
  })

  test('should switch provider', async () => {
    /**
     * @type {AbstractProvider}
     */
    const provider = new FailoverProvider()
      .addProvider(new BrowserProvider(window.ethereum))
      .addProvider(new BrowserProvider(window.ethereum))
      .addProvider(new JsonRpcProvider(RPC_URL, NETWORK))
      .initialize()

    const blockNumber = await provider.getBlockNumber()

    expect(blockNumber).toBe(1)
  })

  describe('shouldRetryOn config', () => {
    test('should not retry on insufficient balance error', async () => {
      /**
       * @type {AbstractProvider}
       */
      const provider = new FailoverProvider({
        shouldRetryOn: (error) => {
          return !/doesn't have enough funds/.test(error?.error?.message)
        },
      })
        .addProvider(new JsonRpcProvider(RPC_URL, NETWORK))
        .addProvider(new BrowserProvider(window.ethereum))
        .initialize()

      const wallet = Wallet.createRandom(provider)

      await expect(async () => {
        await wallet.sendTransaction({
          to: ZeroAddress,
          value: parseEther('1'),
        })
      }).rejects.toThrow(/Sender doesn't have enough funds to send tx/)
    })

    test('should be failed on the default shouldRetryOn', async () => {
      /**
       * @type {AbstractProvider}
       */
      const provider = new FailoverProvider({ retries: 1 })
        .addProvider(new JsonRpcProvider(RPC_URL, NETWORK))
        .addProvider(new BrowserProvider(window.ethereum))
        .initialize()

      const wallet = Wallet.createRandom(provider)

      await expect(async () => {
        await wallet.sendTransaction({
          to: ZeroAddress,
          value: parseEther('1'),
        })
      }).rejects.toThrow(/Provider disconnected/)
    })
  })
})
