const fs = require('fs')
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('../src/index')
const default_cache_filename = require('../src/default_cache_filename')
const dump = require('path').join(__dirname, 'dump')
const factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984'
const filename = default_cache_filename(factory)

describe('Uniswap V3 binary', () => {

    it('Load first 3 pairs and store at default "dump*.bin" files', () =>
        load({
            factory,
            csv: false,
            to: 2
        })
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

    it('Use default "dump*.bin" and load one more pair', () =>
        load({
            factory,
            csv: false,
            to: 3
        })
        .then(pairs => {
            assert.equal(pairs.length, 4, 'Should be 4 pairs')
        })
    )
    
    after(() => {
        fs.unlinkSync(filename + '_pairs.bin')
        fs.unlinkSync(filename + '_tokens.bin')
        fs.unlinkSync(filename + '_p2tt.bin')
    })

})





