# <picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/npm/uniswap-v2-loader@5.0.1/logo-dark.svg"><img alt="calp.pro icon" src="https://cdn.jsdelivr.net/npm/uniswap-v2-loader@5.0.1/logo-light.svg" height="32" align="absmiddle"></picture>&nbsp;&nbsp;uniswap-v3-loader&nbsp;&nbsp;[![Coverage](https://coveralls.io/repos/github/calp-pro/uniswap-v3-loader/badge.svg?branch=main)](https://coveralls.io/github/calp-pro/uniswap-v3-loader)

**Fast DeFi AMM pools loader.** Optimized for **Multi-core CPUs** with smart **disk-cache**.<br>
This package is a loader that allows you to download protocol addresses yourself.<br>
If you want to instantly get all addresses (pools and their tokens), use the packages from the next section.<br>
Those packages check for updates every hour and republish the package with updated data.

## Uniswap V3
- `0x1f98431c8ad98523631ae4a59f267346ea31f984` fabric [contract](https://etherscan.io/address/0x1f98431c8ad98523631ae4a59f267346ea31f984)

## Install
- CLI
  * ```
    npm i -g uniswap-v3-loader
    ```
- Node.js API
  * ```
    npm i --save uniswap-v3-loader
    ```

## CLI
```bash
uniswap-v3-loader --from=1 --to=3
```

## API
Methods:
- `load(config)`
  * return `Promise(<Pair>[])`
- `subscribe(callback, config)`
  * Continuous synchronization engine. Performs initial load and subsequently polls for new pairs.
  * return unsubscribe function

<i>where `config` is common `Object` with set of parameters to loader.</i>

`config` is an Object (key/value)
- `from`
  * Start position index (inclusive).
  * Type: `number`
  * Default: `0`
- `to`
  * End position index (inclusive).
  * Type: `number`
  * Default: `undefined`
- `filename`
  * Cache path. Used for pre-load data and add updates. In case `csv` set to `false` value used as prefix for:
    - `${filename}_pairs.bin`
    - `${filename}_tokens.bin`
    - `${filename}_p2tt.bin`
  * Type: `string`
  * Default: *OS cache folder*
- `csv`
  * Switch cache between CSV and binary via [DEX DB](https://github.com/calp-pro/dex_db)
  * Type: `boolean`
  * Default: `true`
- `factory`
  * Smart contract factory address.
  * Type: `string`
  * Default: `0x1f98431c8ad98523631ae4a59f267346ea31f984`
- `key`
  * Alchemy API Key
  * Type: `string`
  *  Default: `FZBvlPrOxtgaKBBkry3SH0W1IqH4Y5tu`
- `multicall_size`
  * RPC batch size per multicall request.
  * Type:`number`
  * Default: `50`
- `workers`
  * Number of parallel worker threads.
  * Type: `number`
  * Default: `CPU - 1`
- `progress`
  * Each loaded pair execute this callback: `(id, total, pair) => {}`.
  * Callback arguments:
    - `id` fabric index of pair contract (int)
    - `total` total amount of pairs at fabric at current moment
    - `pair` instance of `Pair`(`{id: number, pair: string, token0: string, token1: string}`)
  * Type: `function`
  * Default: `undefined`
- `abort_signal`
  * Signal to cancel loading and release workers.
  * Type: [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
  * Default: `undefined`
- `update_timeout`
  * Polling interval in milliseconds. Used only in `subscribe`
  * Type: `number`
  * Default: `5000`

### Schema `Pair`
Standardized liquidity pool object.

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Numeric position index of NonfungiblePositionManager |
| `pair` | `string` | DEX pair address |
| `token0` | `string` | Token address |
| `token1` | `string` | Token address |


**Example `<Pair>[]`**
```json
[
  {
    "id": 0,
    "pair": "0xac7842f2d70a223be787126dd06f0b072d117c0d",
    "token0": "0xb9683e8c8613e6209ad4756fc4b4842b4edd15a8",
    "token1": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
  }
]
```

### Smart Cross-Platform Caching
The loader automatically identifies the optimal persistent storage path for your operating system to ensure zero-configuration caching:
- **Linux:** `$XDG_CACHE_HOME` or `~/.cache/`
- **macOS:** `~/Library/Caches/`
- **Windows:** `%LOCALAPPDATA%` or `AppData/Local/`

There are binary compact cache or CSV.<br>
Binary cache done via [DEX DB](https://github.com/calp-pro/dex_db)

Cache files are named following the pattern:
- `${package_name}_{factory_address}.csv`
- `${package_name}_{factory_address}_pairs.bin`
- `${package_name}_{factory_address}_tokens.bin`
- `${package_name}_{factory_address}_p2tt.bin`



## API Usage
```javascript
const { load } = require('uniswap-v3-loader')

console.time('Uniswap v3')

load({ 
  factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
  to: 100,
  progress: (i, total, pair) =>
    console.log(pair.token0, pair.token1)
})
.then(pairs => {
  console.timeEnd('Uniswap v3')
  console.log(pairs.length, 'pairs')
})
```
