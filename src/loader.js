const fs = require('fs')
const npm = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
var buf
const IDS = []

function get_tokens_ids_by_indexes(filename, indexes) {
    const indexes_load = indexes.filter(_ => !IDS[_])

    return indexes_load.length == 0
        ? Promise.resolve(indexes.map(_ => IDS[_]))
        : fetch(
            'https://eth-mainnet.g.alchemy.com/v2/euEV_WdPWxmaSWLlGyKr9',
            {
                method:'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    indexes_load.map(index => ({
                        jsonrpc:'2.0',
                        id: index,
                        method:'eth_call',
                        params: [{
                            to: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
                            data: '0x4f6ccce7' + index.toString(16).padStart(64,'0')
                        }, 'latest']
                    }))
                )
            }
        )
        .then(_ => _.json())
        .then(_ => {
            _.forEach(({id, result}) => {
                IDS[id] = parseInt(result, 16)
            })
            buf = Buffer.alloc(IDS.length * 4)
            IDS.forEach((id, i) => buf.writeUInt32LE(id, i * 4))
            fs.writeFileSync(filename + '_tokens_ids.bin', buf)
            
            return indexes.map(_ => IDS[_])
        })
}

const get_pairs = (key, factory, ids, result, abort_signal) => ids.length == 0
    ? Promise.resolve([])
    : fetch('https://eth-mainnet.g.alchemy.com/v2/' + key, {
        signal: abort_signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.keys(ids).map(id => ({
            jsonrpc: '2.0',
            id,
            method: 'eth_call',
            params: [{
                to: factory,
                data: '0x1698ee82' +
                    ids[id].token0.slice(2).padStart(64, '0') +
                    ids[id].token1.slice(2).padStart(64, '0') +
                    ids[id].fee.toString(16).padStart(64, '0')
            }, 'latest']
        })))
    }).then(
        _ => {
            if (_.ok) return _.json()
            throw 'respond not ok'
        },
        _ => {
            throw _.cause?.message || 'failed fetch'
        }
    )    
    .then(responds => {
        const failed_ids = {}
        responds.forEach(respond =>
            respond.result
                ? result[respond.id] = '0x' + respond.result.slice(2).slice(24)
                : failed_ids[respond.id] = ids[respond.id]
        )
        return Object.keys(failed_ids).length == 0
            ? result
            : new Promise(resolve => setTimeout(() => resolve(
                get_pairs(key, factory, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? [] : new Promise(resolve => setTimeout(() => resolve(get_pairs(key, factory, ids, result, abort_signal)), 10000)))

const get_tokens = (key, ids, result, abort_signal) => ids.length == 0
    ? Promise.resolve(result)
    : fetch('https://eth-mainnet.g.alchemy.com/v2/' + key, {
        signal: abort_signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
            ids.map(id => ({
                jsonrpc:'2.0',
                id,
                method:'eth_call',
                params: [{
                    to: npm,
                    data: '0x99fbab88' + id.toString(16).padStart(64,'0')
                }, 'latest']
            }))
        )
    }).then(
        _ => {
            if (_.ok) return _.json()
            throw 'respond not ok'
        },
        _ => {
            throw _.cause?.message
        }
    ).then(responds => {
        const failed_ids = []

        for (var i = 0; i < responds.length; i++) {
            var respond = responds[i]
            if (respond.result)
                result[respond.id] = {
                    token0: '0x' + respond.result.slice(2 + 64 * 2, 2 + 64 * 3).slice(24),
                    token1: '0x' + respond.result.slice(2 + 64 * 3, 2 + 64 * 4).slice(24),
                    fee: Number('0x' + respond.result.slice(2 + 64 * 4, 2 + 64 * 5))
                }
            else
                failed_ids.push(respond.id)
        }

        return failed_ids.length == 0
            ? result
            : new Promise(resolve => setTimeout(() => resolve(
                get_tokens(key, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? {} : new Promise(resolve => setTimeout(() => resolve(get_tokens(key, ids, result, abort_signal)), 10000)))

const main = ({indexes, factory, key, multicall_size, abort_signal, filename}, onpair) => {
    if (fs.existsSync(filename + '_tokens_ids.bin')) {
        buf = fs.readFileSync(filename + '_tokens_ids.bin')
        for (let i = 0; i < buf.length; i += 4)
            IDS.push(buf.readUInt32LE(i))
    }

    
    const chunks = []
    for (let i = 0; i < indexes.length; i += multicall_size)
        chunks.push(indexes.slice(i, i + multicall_size))

    return chunks.reduce((p, indexes, ic) =>
        p.then(() =>
            get_tokens_ids_by_indexes(filename, indexes).then(tokens_ids =>
                get_tokens(key, tokens_ids, {}, abort_signal).then(tokens => //where tokens = {23: {token0: 0x.., token1: 0x, fee: 2500}, }
                    get_pairs(key, factory, tokens, {}, abort_signal).then(pairs =>
                        indexes.forEach((index, i) => {
                            var id = tokens_ids[i]
                            onpair({
                                id: index,
                                pair: pairs[id],
                                token0: tokens[id].token0,
                                token1: tokens[id].token1
                            })
                        })
                    )
                )
            )
        ),
        Promise.resolve()
    )
}


if (require.main != module) {
    module.exports = main
} else {
    const abort_controller = new AbortController()
    const abort_signal = abort_controller.signal

    process.on(
        'message',
        message => {
            if (message == 'abort')
                abort_controller.abort()
            else
                main({...message, abort_signal}, pair => process.send(pair))
                .finally(() => process.exit())
        }
    )
}