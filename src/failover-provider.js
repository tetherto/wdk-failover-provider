// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'

/**
 * @typedef {Object} FailoverProviderConfig
 * @property {number} [retries] - The number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3.
 * @property {(error: Error) => boolean} [shouldRetryOn] - Define errors that the failover provider should retry. By default, it will retry on any errors.
 */

/**
 * @template T
 * @typedef {Object} ProviderProxy<T>
 * @property {string} id - The unique identifier for the provider.
 * @property {T} provider - The underlying provider instance.
 * @property {number} ms - The last response duration, used for future provider ranking.
 */

/**
 * Generates a simple UID using Math.random().
 *
 * @param {number} len - The desired UID length.
 * @returns {string} A UID string of the specified length.
 */
function uid (len = 12) {
  if (len < 1 || len > 256) {
    throw new Error('The UID length must be between 1 and 256 characters.')
  }
  let id = ''
  while (id.length < len) {
    id += Math.round(Math.random() * 10)
  }
  return id
}

/**
 * @template {{}} T
 */
export default class FailoverProvider {
  /**
   * Creates a failover provider factory. Use addProvider() to register provider candidates, then call initialize() to construct the final failover-enabled provider instance.
   *
   * @param {FailoverProviderConfig} [config] - The failover factory config.
   */
  constructor ({ retries = 3, shouldRetryOn = (error) => error instanceof Error } = {}) {
    /**
     * The number of retries before the failover provider throws an error.
     *
     * @private
     * @type {FailoverProviderConfig["retries"]}
     */
    this._retries = retries

    /**
     * Define errors that the failover provider should retry.
     *
     * @private
     * @type {FailoverProviderConfig["shouldRetryOn"]}
     */
    this._shouldRetryOn = shouldRetryOn

    /**
     * The current active provider index.
     *
     * @private
     * @type {number}
     */
    this._activeProvider = 0

    /**
     * The list of provider candidates.
     *
     * @private
     * @type {Array<ProviderProxy<T>>}
     */
    this._providers = []
  }

  /**
   * Add a provider into the list of candidates.
   *
   * @param {T} provider The candidate provider.
   * @returns {FailoverProvider<T>} The instance of FailoverProvider.
   */
  addProvider (provider) {
    this._providers.push({ id: uid(), provider, ms: 0 })
    return this
  }

  /**
   * Initialize the failover mechanism based on provider candidates.
   *
   * @returns {T} The failover-enabled provider instance.
   * @throws {Error} When no providers have been added via addProvider().
   */
  initialize () {
    if (!this._providers.length) {
      throw new Error(
        'Cannot initialize an empty provider. Call `addProvider` before this function.'
      )
    }

    const [{ provider }] = this._providers

    return new Proxy(provider, {
      get: (_, p, receiver) => {
        return this._proxy(this._providers[this._activeProvider], p, receiver)
      }
    })
  }

  /**
   * Advances to the next provider using round-robin selection.
   * If the active provider has not changed since the failure occurred, it moves to the next provider.
   * Otherwise, it keeps the current one to avoid race-condition conflicts.
   *
   * @private
   * @param {ProviderProxy<T>} failedProvider - The provider that triggered the switch.
   * @returns {ProviderProxy<T>} The selected provider.
   */
  _switch (failedProvider) {
    // Only advance if the active provider is still the failed one
    if (failedProvider.id === this._providers[this._activeProvider].id) {
      this._activeProvider = (this._activeProvider + 1) % this._providers.length
    }
    return this._providers[this._activeProvider]
  }

  /**
   * Proxy handler will keep retry until a response or throw the latest error.
   *
   * @private
   * @param {ProviderProxy<T>} target The current active provider.
   * @param {string | symbol} p The method/property name.
   * @param {unknown} receiver The JS Proxy.
   * @param {number} retries The number of retries.
   * @returns {(string extends keyof T ? T[keyof T & string] : any) | (symbol extends keyof T ? T[keyof T & symbol] : any) | ((...args: any[]) => any | Promise<any>)}
   */
  _proxy (target, p, receiver, retries = this._retries) {
    let prop

    // Immediately return if the property is not a function
    try {
      prop = Reflect.get(target.provider, p, receiver)
      if (typeof prop !== 'function') return prop
    } catch (er) {
      if (retries <= 0 || !this._shouldRetryOn(er)) throw er
      const provider = this._switch(target)
      return this._proxy(provider, p, receiver, retries - 1)
    }

    /**
     * @param {...any} args
     * @returns {any | Promise<any>}
     */
    return (...args) => {
      /**
       * @type {any | Promise<any>}
       */
      let re

      // Retry on sync functions
      try {
        re = prop.apply(target.provider, args)
        if (!re?.then) return re
      } catch (er) {
        if (retries <= 0 || !this._shouldRetryOn(er)) throw er
        const provider = this._switch(target)
        const property = this._proxy(provider, p, receiver, retries - 1)
        if (typeof property === 'function') return property.apply(this, args)
        return property
      }

      // Retry on async functions
      return re
        .then(
          /**
           * @param {any} re
           */
          (re) => re
        )
        .catch(
          /**
           * @param {Error} er
           */
          (er) => {
            if (retries <= 0 || !this._shouldRetryOn(er)) throw er
            const provider = this._switch(target)
            const property = this._proxy(provider, p, receiver, retries - 1)
            if (typeof property === 'function') return property.apply(this, args)
            return property
          }
        )
    }
  }
}
