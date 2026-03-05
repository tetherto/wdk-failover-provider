/**
 * @template {{}} T
 */
export default class FailoverProvider<T extends {}> {
    /**
     * Creates a failover provider factory. Use addProvider() to register provider candidates, then call initialize() to construct the final failover-enabled provider instance.
     *
     * @param {FailoverProviderConfig} [config] - The failover factory config.
     */
    constructor({ retries, shouldRetryOn }?: FailoverProviderConfig);
    /**
     * The number of retries before the failover provider throws an error.
     *
     * @private
     * @type {FailoverProviderConfig["retries"]}
     */
    private _retries;
    /**
     * Define errors that the failover provider should retry.
     *
     * @private
     * @type {FailoverProviderConfig["shouldRetryOn"]}
     */
    private _shouldRetryOn;
    /**
     * The current active provider index.
     *
     * @private
     * @type {number}
     */
    private _activeProvider;
    /**
     * The list of provider candidates.
     *
     * @private
     * @type {Array<ProviderProxy<T>>}
     */
    private _providers;
    /**
     * Add a provider into the list of candidates.
     *
     * @param {T} provider The candidate provider.
     * @returns {FailoverProvider<T>} The instance of FailoverProvider.
     */
    addProvider(provider: T): FailoverProvider<T>;
    /**
     * Initialize the failover mechanism based on provider candidates.
     *
     * @returns {T} The failover-enabled provider instance.
     * @throws {Error} When no providers have been added via addProvider().
     */
    initialize(): T;
    /**
     * Advances to the next provider using round-robin selection.
     * If the active provider has not changed since the failure occurred, it moves to the next provider.
     * Otherwise, it keeps the current one to avoid race-condition conflicts.
     *
     * @private
     * @param {ProviderProxy<T>} failedProvider - The provider that triggered the switch.
     * @returns {ProviderProxy<T>} The selected provider.
     */
    private _switch;
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
    private _proxy;
}
export type FailoverProviderConfig = {
    /**
     * - The number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3.
     */
    retries?: number;
    /**
     * - Define errors that the failover provider should retry. By default, it will retry on any errors.
     */
    shouldRetryOn?: (error: Error) => boolean;
};
/**
 * <T>
 */
export type ProviderProxy<T> = {
    /**
     * - The unique identifier for the provider.
     */
    id: string;
    /**
     * - The underlying provider instance.
     */
    provider: T;
    /**
     * - The last response duration, used for future provider ranking.
     */
    ms: number;
};
