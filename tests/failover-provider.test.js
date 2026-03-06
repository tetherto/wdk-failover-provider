import FailoverProvider from '@tetherto/wdk-failover-provider'

import { describe, expect, test } from '@jest/globals'

class Animal {
  /**
   * @constructor
   * @param {string} name
   * @param {string} [sound]
   * @param {number} [pace]
   */
  constructor(name, sound = '...', pace = 300) {
    /**
     * @type {string}
     */
    this.name = name

    /**
     * @type {string}
     */
    this.sound = sound

    /**
     * @type {number}
     */
    this.pace = pace
  }

  get NAME() {
    return this.name
  }

  get SOUND() {
    return this.sound
  }

  syncSpeak = () => {
    return this.sound
  }

  speak = async () => {
    await new Promise((r) => setTimeout(r, this.pace))
    return this.sound
  }
}

describe('FailoverProvider', () => {
  class Cat extends Animal {
    constructor() {
      super('Cat', 'meow')
    }
  }

  class Dog extends Animal {
    constructor() {
      super('Dog', 'woof')
    }
  }

  class Cockroach extends Animal {
    constructor() {
      super('Cockroach')
    }

    get SOUND() {
      throw new Error("A cockroach doesn't have sound.")
    }

    speak = async () => {
      throw new Error("A cockroach doesn't speak, it flies.")
    }

    syncSpeak = () => {
      throw new Error("A cockroach doesn't speak, it flies.")
    }
  }

  test('should access the public property', () => {
    /**
     * @type {Animal}
     */
    const animal = new FailoverProvider().addProvider(new Cat()).addProvider(new Dog()).initialize()

    expect(animal.name).toBe('Cat')
  })

  test('should access the getter', () => {
    /**
     * @type {Animal}
     */
    const animal = new FailoverProvider().addProvider(new Cat()).addProvider(new Dog()).initialize()

    expect(animal.NAME).toBe('Cat')
  })

  test('should retry on the failed getter', () => {
    /**
     * @type {Animal}
     */
    const animal = new FailoverProvider()
      .addProvider(new Cockroach())
      .addProvider(new Dog())
      .initialize()

    expect(animal.SOUND).toBe('woof')
  })

  describe('sync providers', () => {
    test('should accept polymorphism', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider()
        .addProvider(new Cat())
        .addProvider(new Dog())
        .initialize()

      const spoke = animal.syncSpeak()
      expect(spoke).toBe('meow')
    })

    test('should switch provider', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider()
        .addProvider(new Cockroach())
        .addProvider(new Dog())
        .addProvider(new Cat())
        .initialize()

      const spoke = animal.syncSpeak()
      expect(spoke).toBe('woof')
    })

    test('should retry 1 times and fail', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider({ retries: 1 })
        .addProvider(new Cockroach())
        .addProvider(new Cockroach())
        .addProvider(new Cat())
        .addProvider(new Dog())
        .initialize()

      expect(() => {
        animal.syncSpeak()
      }).toThrow("doesn't speak")
    })

    describe('shouldRetryOn config', () => {
      test('should not retry on custom shouldRetryOn', async () => {
        /**
         * @type {Animal}
         */
        const animal = new FailoverProvider({
          shouldRetryOn: (error) => {
            if (error instanceof Error) {
              return !/cockroach/.test(error.message)
            }
            return true
          },
        })
          .addProvider(new Cockroach())
          .addProvider(new Cat())
          .addProvider(new Dog())
          .initialize()

        expect(() => {
          animal.syncSpeak()
        }).toThrow("doesn't speak")
      })

      test('should retry on the default shouldRetryOn', async () => {
        /**
         * @type {Animal}
         */
        const animal = new FailoverProvider()
          .addProvider(new Cockroach())
          .addProvider(new Cat())
          .addProvider(new Dog())
          .initialize()

        const spoken = animal.syncSpeak()
        expect(spoken).toBe('meow')
      })
    })
  })

  describe('async providers', () => {
    test('should accept polymorphism', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider()
        .addProvider(new Cat())
        .addProvider(new Dog())
        .initialize()

      const spoke = await animal.speak()
      expect(spoke).toBe('meow')
    })

    test('should switch provider', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider()
        .addProvider(new Cockroach())
        .addProvider(new Dog())
        .addProvider(new Cat())
        .initialize()

      const spoke = await animal.speak()
      expect(spoke).toBe('woof')
    })

    test('should retry 1 times and fail', async () => {
      /**
       * @type {Animal}
       */
      const animal = new FailoverProvider({ retries: 1 })
        .addProvider(new Cockroach())
        .addProvider(new Cockroach())
        .addProvider(new Cat())
        .addProvider(new Dog())
        .initialize()

      await expect(async () => {
        await animal.speak()
      }).rejects.toThrow("doesn't speak")
    })

    describe('shouldRetryOn config', () => {
      test('should not retry on custom shouldRetryOn', async () => {
        /**
         * @type {Animal}
         */
        const animal = new FailoverProvider({
          shouldRetryOn: (error) => {
            if (error instanceof Error) {
              return !/cockroach/.test(error.message)
            }
            return true
          },
        })
          .addProvider(new Cockroach())
          .addProvider(new Cat())
          .addProvider(new Dog())
          .initialize()

        await expect(async () => {
          await animal.speak()
        }).rejects.toThrow("doesn't speak")
      })

      test('should retry on the default shouldRetryOn', async () => {
        /**
         * @type {Animal}
         */
        const animal = new FailoverProvider()
          .addProvider(new Cockroach())
          .addProvider(new Cat())
          .addProvider(new Dog())
          .initialize()

        const spoken = await animal.speak()
        expect(spoken).toBe('meow')
      })
    })
  })
})
