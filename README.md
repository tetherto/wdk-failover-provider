# WDK Failover Provider

Zero-dependency failover mechanism for seamless fallback when providers break.

## 🔍 About WDK

This module is part of [**WDK (Wallet Development Kit) by Tether**](https://wdk.tether.io/), which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

See the [Failover Provider documentation](https://docs.wdk.tether.io/tools/failover-provider/). For the complete ecosystem, see the [general WDK documentation](https://docs.wdk.tether.io/).

## ⬇️ Installation

```bash
npm install @tetherto/wdk-failover-provider
```

## 🚀 Quick Start

```ts
import FailoverProvider from '@tetherto/wdk-failover-provider'
import { type AbstractProvider, JsonRpcProvider, BrowserProvider } from 'ethers'

const RPC_PROVIDER = 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'

// Create a failover provider that will try the BrowserProvider first,
// then fallback to a JSON-RPC provider on errors.
const provider = new FailoverProvider<AbstractProvider>()
  .addProvider(new BrowserProvider(window.ethereum))
  .addProvider(new JsonRpcProvider(RPC_PROVIDER))
  .initialize()

// Calls are proxied and will failover according to the configured retries
;(async () => {
  const blockNumber = await provider.getBlockNumber()
  console.log('block number', blockNumber)
})()
```

## 📚 API Reference

This package exposes a single default export: the `FailoverProvider` factory.

- `new FailoverProvider(config?)` — Create a factory.
  - `config.retries` (number, default `3`): The number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order.
  - `config.shouldRetryOn` (function, default: `error => error instanceof Error`): predicate to determine whether to retry on a given error.

- `instance.addProvider(provider)` — Add a provider candidate. `provider` can be any object (sync or async methods).

- `instance.initialize()` — Return a proxied provider. Calls to methods are intercepted and automatically retried/failover according to the configuration.

Behavior notes:

- The returned proxied provider forwards non-function properties from the currently active provider.
- When a method throws exceptions and `shouldRetryOn(error)` returns `true`, the proxy switches to the next provider (round-robin) and retries until retries are exhausted.

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.
