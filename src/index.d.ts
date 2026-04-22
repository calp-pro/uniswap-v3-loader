/**
 * Represents a pair from a Uniswap V3 protocol.
 */
export interface pair {
  /** The index of the pair in the factory. */
  id: number
  /** The address of the pair contract. */
  pair: string
  /** The address of token0. */
  token0: string
  /** The address of token1. */
  token1: string
}

/**
 * Parameters for the load function.
 */
export interface load_params {
  /** RPC URL for Ethereum node (Alchemy,QuickNode,Anrk,ect.). */
  RPC_URL?: string
  /** The address of a Uniswap V3 factory. */
  factory?: string
  /** Path to the cache file. Set to null to disable caching. */
  filename?: string | null
  /** Number of pairs to fetch in a single multicall. */
  multicall_size?: number
  /** Start loading from this index. */
  from?: number
  /** Load up to this index (inclusive). */
  to?: number
  /** Progress callback. */
  progress?: (current: number, total: number) => void
  /** Existing pairs to start with (used for updates). */
  pairs?: pair[]
  /** Timeout between updates in milliseconds. */
  update_timeout?: number
  /** Signal to abort the loading process. */
  abort_signal?: AbortSignal
}

/**
 * Loads pairs from a Uniswap V3 factory.
 * @param params Loading configuration.
 * @returns A promise that resolves to an array of pairs.
 */
export function load(params?: load_params): Promise<pair[]>

/**
 * Subscribes to new pairs being added to the factory.
 * @param callback Called with total available data first and then whenever new pairs added to factory.
 * @param params Loading configuration.
 * @returns An unsubscribe function.
 */
export function subscribe(
  callback: (pairs: pair[]) => void,
  params?: load_params
): () => void
