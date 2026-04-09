const fs = require('fs')
const path = require('path')
const default_cache_filename = require('./default_cache_filename')
const dex_db = require('@calp-pro/dex-db')
const debug_key = process.env.KEY || 'euEV_WdPWxmaSWLlGyKr9'
const uniswap_v3_factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984'

const load = (params = {}) => {
    var {
        key = debug_key,
        filename,
        csv = true,
        multicall_size = 50,
        from = 0,
        to,
        progress,
        abort_signal,
        pairs,
    } = params

    if (!filename) {
        filename = default_cache_filename(uniswap_v3_factory)
        if (csv) filename += '.csv'
    }

    var db
    
    if (!pairs) {
        if (csv) {
            pairs = fs.existsSync(filename)
                ? fs.readFileSync(filename).toString().trim().split('\n')
                    .reduce((pairs, line) => {
                        line = line.split(',')
                        const id = +line[0]
                        if (id >= from && (to == undefined || id <= to)) pairs.push({
                            id,
                            pair: line[1],
                            token0: line[2],
                            token1: line[3]
                        })
                        return pairs
                    }, [])
                : []
        } else {
            pairs = []
            db = dex_db()
            if (
                fs.existsSync(filename + '_pairs.bin') &&
                fs.existsSync(filename + '_tokens.bin') &&
                fs.existsSync(filename + '_p2tt.bin')
            ) {
                db.load(filename)
                db.get_all_pairs().forEach((pair, i) => {
                    const tokens = db.get_pair_tokens(pair)
                    pairs[i] = {
                        id: i,
                        pair,
                        token0: tokens[0],
                        token1: tokens[1]
                    }
                })
            }
        }
    }

    if (to >= 0 && to <= pairs.length - 1) {
        if (progress)
            for (var i = from; i <= to; i++)
                progress(pairs[i].id, to, pairs[i])

        return Promise.resolve(pairs.slice(from, to + 1))
    }

    return (to
        ? Promise.resolve(to)
        : fetch('https://eth-mainnet.g.alchemy.com/v2/' + key, {
            signal: abort_signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{ to: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', data: '0x18160ddd' }, 'latest']
            })
        }).then(
            _ => {
                if (_.ok) return _.json().then(_ => {
                    const total_pools = Number(_.result)
                    if (total_pools > 0) {
                        const last_id = total_pools - 1
                        return last_id
                    }
                    return 0
                })
                throw 'fail start'
            },
            _ => {
                throw 'fetch failed'
            }
        )
    ).then(last_id => {
        const start_loading_from = pairs.length
            ? Math.max(from, pairs[pairs.length - 1].id + 1)
            : from

        var next_pair_order = pairs.length
            ? pairs[pairs.length - 1].id + 1
            : 0

        if (progress)
            for (var i = from; i < start_loading_from; i++)
                progress(pairs[i].id, last_id + 1, pairs[i])
        
        const onpair = csv
            ? pair => {
                pairs[pair.id] = pair
                if (progress && pair.id >= from) progress(pair.id, last_id + 1, pair)
                var _
                while (_ = pairs[next_pair_order]) {
                    fs.appendFileSync(filename, `${_.id},${_.pair},${_.token0},${_.token1}\n`)
                    next_pair_order++
                }
            }
            : pair => {
                pairs[pair.id] = pair
                if (progress && pair.id >= from) progress(pair.id, last_id + 1, pair)
                var _
                while (_ = pairs[next_pair_order]) {
                    db.index_save(_.pair, _.token0, _.token1, filename)
                    next_pair_order++
                }
            }

        const indexes = []
        for (var i = start_loading_from; i <= last_id; i++)
            indexes.push(i)
        return require('./loader')({
            indexes,
            factory: uniswap_v3_factory,
            key,
            multicall_size,
            abort_signal,
            filename: csv ? filename.replace('.csv', '') : filename
        }, onpair)
        .then(() => {
            if (from && to) return pairs.filter(({id}) => id >= from && id <= to)
            if (from) return pairs.filter(({id}) => id >= from)
            if (to) return pairs.filter(({id}) => id <= to)
            return pairs
        })
    })
    .catch(e => abort_signal?.aborted ? pairs : new Promise(resolve => setTimeout(() => resolve(load(params)), 1000)))
}

module.exports.load = (params = {}) =>
    load(params)

module.exports.subscribe = (callback, params = {}) => {
    params.update_timeout ??= 5000
    var subscribed = true, timeout
    load(params)
    .then(pairs => {
        callback(pairs)

        const update = pairs =>
            timeout = setTimeout(
                () =>
                    subscribed && load({...params, pairs, from: pairs.length})
                    .then(pairs => {
                        if (!subscribed) return
                        callback(pairs)
                        if (!subscribed) return
                        if (params.to && pairs[pairs.length - 1].id >= params.to) return
                        update(pairs)
                    }),
                params.update_timeout
            )

        if (!subscribed) return
        if (params.to && pairs[pairs.length - 1].id >= params.to) return
        update(pairs)
    })

    return () => {
        subscribed = false
        if (timeout) clearTimeout(timeout)
    }
}
