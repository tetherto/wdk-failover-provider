import FailoverProvider from '@tetherto/wdk-failover-provider'

import { describe, expect, test } from '@jest/globals'

class Client {
  constructor (name) {
    this._name = name
  }

  get name () {
    if (!this._name) throw new Error('Empty name.')
    return this._name
  }

  getNameSync () {
    return this.name
  }

  async getNameAsync () {
    return new Promise((resolve, reject) => {
      try {
        return resolve(this.name)
      } catch (er) {
        return reject(er)
      }
    })
  }

  get rpc () {
    return {
      getStatus: () => {
        return `${this.name} is connected.`
      },
      getBlockhash: async () => {
        return new Promise((resolve, reject) => {
          try {
            const name = this.name
            const blockhash = Math.ceil(Math.random() * 1000)
            return setTimeout(() => resolve({ [name]: blockhash }), 1)
          } catch (er) {
            return reject(er)
          }
        })
      }
    }
  }
}

describe('FailoverProvider', () => {
  const workingClient = new Client('working-client')
  const failedClient = new Client()

  test('should accept polymorphism', async () => {
    const client = new FailoverProvider()
      .addProvider(workingClient)
      .addProvider(failedClient)
      .initialize()

    expect(client instanceof Client).toBe(true)
  })

  test('should access the public property', () => {
    const client = new FailoverProvider()
      .addProvider(workingClient)
      .addProvider(failedClient)
      .initialize()

    expect(client._name).toBe('working-client')
  })

  test('should access the getter', () => {
    const client = new FailoverProvider()
      .addProvider(workingClient)
      .addProvider(failedClient)
      .initialize()

    expect(client.name).toBe('working-client')
  })

  test('should retry on the failed getter', () => {
    const client = new FailoverProvider()
      .addProvider(failedClient)
      .addProvider(workingClient)
      .initialize()

    expect(client.name).toBe('working-client')
  })

  describe('sync providers', () => {
    test('should switch provider', async () => {
      const client = new FailoverProvider()
        .addProvider(failedClient)
        .addProvider(workingClient)
        .initialize()

      const name = client.getNameSync()
      expect(name).toBe('working-client')
    })

    test('should retry 1 times and fail', async () => {
      const client = new FailoverProvider({ retries: 1 })
        .addProvider(failedClient)
        .addProvider(new Client())
        .addProvider(workingClient)
        .initialize()

      expect(() => {
        client.getNameSync()
      }).toThrow('Empty name.')
    })

    describe('shouldRetryOn config', () => {
      test('should not retry on custom shouldRetryOn', async () => {
        const client = new FailoverProvider({
          shouldRetryOn: (error) => {
            if (error instanceof Error) {
              return !/Empty name/.test(error.message)
            }
            return true
          }
        })
          .addProvider(failedClient)
          .addProvider(workingClient)
          .initialize()

        expect(() => {
          client.getNameSync()
        }).toThrow('Empty name.')
      })

      test('should retry on the default shouldRetryOn', async () => {
        const client = new FailoverProvider()
          .addProvider(failedClient)
          .addProvider(workingClient)
          .initialize()

        const name = client.getNameSync()
        expect(name).toBe('working-client')
      })
    })
  })

  describe('async providers', () => {
    test('should switch provider', async () => {
      const client = new FailoverProvider()
        .addProvider(failedClient)
        .addProvider(workingClient)
        .initialize()

      const name = await client.getNameAsync()
      expect(name).toBe('working-client')
    })

    test('should retry 1 times and fail', async () => {
      const client = new FailoverProvider({ retries: 1 })
        .addProvider(failedClient)
        .addProvider(new Client())
        .addProvider(workingClient)
        .initialize()

      await expect(async () => {
        await client.getNameAsync()
      }).rejects.toThrow('Empty name.')
    })

    describe('shouldRetryOn config', () => {
      test('should not retry on custom shouldRetryOn', async () => {
        const client = new FailoverProvider({
          shouldRetryOn: (error) => {
            if (error instanceof Error) {
              return !/Empty name/.test(error.message)
            }
            return true
          }
        })
          .addProvider(failedClient)
          .addProvider(workingClient)
          .initialize()

        await expect(async () => {
          await client.getNameAsync()
        }).rejects.toThrow('Empty name.')
      })

      test('should retry on the default shouldRetryOn', async () => {
        const client = new FailoverProvider()
          .addProvider(failedClient)
          .addProvider(workingClient)
          .initialize()

        const name = await client.getNameAsync()
        expect(name).toBe('working-client')
      })
    })
  })

  describe('nested object providers', () => {
    test('should access the nested sync function', () => {
      const client = new FailoverProvider()
        .addProvider(workingClient)
        .addProvider(failedClient)
        .initialize()

      expect(client.rpc.getStatus()).toBe('working-client is connected.')
    })

    test('should retry on the failed nested sync function', () => {
      const client = new FailoverProvider()
        .addProvider(failedClient)
        .addProvider(workingClient)
        .initialize()

      expect(client.rpc.getStatus()).toBe('working-client is connected.')
    })

    test('should retry on the failed nested async function', async () => {
      const client = new FailoverProvider()
        .addProvider(failedClient)
        .addProvider(workingClient)
        .initialize()

      await expect(client.rpc.getBlockhash()).resolves.toHaveProperty('working-client')
    })
  })
})
