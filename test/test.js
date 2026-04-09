const fs = require('fs')
const { describe, before, it } = require('node:test')
const assert = require('node:assert/strict')
const {load, subscribe} = require('../src/index')
const default_cache_filename = require('../src/default_cache_filename')

describe('Uniswap V3', () => {
    const uniswap_v3_factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984'
    const uniswap_v3_cache_filename = default_cache_filename(uniswap_v3_factory) + '.csv'

    before(() => {
        if (fs.existsSync(uniswap_v3_cache_filename))
            fs.unlinkSync(uniswap_v3_cache_filename)
    })
    
    it('Exist USDC/USDP pair', () =>
        load({to: 2})
        .then(pairs => {
            assert.deepEqual(pairs, [
                {
                    "id": 0,
                    "pair": "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801",
                    "token0": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
                    "token1": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
                },
                {
                    "id": 1,
                    "pair": "0x6c6bc977e13df9b0de53b251522280bb72383700",
                    "token0": "0x6b175474e89094c44da98b954eedeac495271d0f",
                    "token1": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                },
                {
                    "id": 2,
                    "pair": "0x7bea39867e4169dbe237d55c8242a8f2fcdcc387",
                    "token0": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    "token1": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
                }
            ])
        })
    )

    it('Re-load first three pairs to custom CSV file', () => {
        // If user specify a filename then
        // a cache data will be taken from
        // the filename provided. If file is empty then
        // data will be uploaded again from network then
        // new file would be created and data would be stored.
        const filename = Date.now() + '.csv'
        return load({to: 2, filename})
        .then(() => {
            const lines = fs.readFileSync(filename).toString().trim().split('\n')
            assert.equal(lines.length, 3, 'if "to" is 2 then 0,1,2 should be loaded')
        })
        .finally(() => {
            fs.unlinkSync(filename)
        })
    })

    it('.subscribe should call provided callback with all 3 pairs (0,1,2 - ids) for a current moment (from cache)', () =>
        new Promise(y => {
            const unsubscribe = subscribe(pairs => {
                assert.equal(pairs.length, 3)
                unsubscribe()
                y()
            }, {to: 2})
        })
    )

    it('No multi-core. Same process load +3 pairs', () =>
        load({to: 2 + 3})
        .then(pairs => {
            assert.equal(pairs.length, 6)
        })
    )

    it('Each line at CSV cache file should be orderd by pair id (factory id)', () => {
        const lines = fs.readFileSync(uniswap_v3_cache_filename, 'utf8').trim().split('\n')
        for (var i = 0; i < lines.length; i++)
            assert.equal(i, +lines[i].split(',').shift())
    })
    
    it('Loading 10 pairs (ids: [0-9]) each pair should be call "progress" - 10 calls', () => {
        var progress_call_count = 0
        load({
            to: 9,
            progress: () => progress_call_count++
        })
        .then(() => {
            assert.equal(progress_call_count, 10)
        })
    })

    it('Graceful shutdown after +1 pair loaded', () => {
        const abort_controller = new AbortController()
        const abort_signal = abort_controller.signal
        var once = true

        return load({
            progress: () => {
                if (once) {
                    onece = false
                    setTimeout(() => abort_controller.abort(), 0)
                }
            },
            abort_signal
        })
    })

    it('Graceful shutdown after +1 pair loaded (main process send "abort" message to worker)', () => {
        const abort_controller = new AbortController()
        const abort_signal = abort_controller.signal
        var once = true
        
        return load({
            progress: () => {
                if (once) {
                    onece = false
                    setTimeout(() => abort_controller.abort(), 0)
                }
            },
            abort_signal
        })
    })

    it('Should load only id 487004 (TOTO/WETH) where token1 is 42 chars length', () => {
        return load({
            from: 487004,
            to: 487004
        })
        .then(pairs => {
            assert.equal(pairs[0].token1.length, 42)
        })
    })

})





