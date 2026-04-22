const fs = require('fs')
const npm = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
var buf
const IDS = []

function get_tokens_ids_by_indexes(RPC_URL, filename, indexes, result, abort_signal) {//result is map between index and id
    const indexes_load = []
    for (var i = 0, index; i < indexes.length; i++) {
        index = indexes[i]
        if (IDS[index])
            result.set(index, IDS[index])
        else 
            indexes_load.push(index)
    }

    if (indexes_load.length == 0) {
        buf = Buffer.alloc(IDS.length * 4)
        IDS.forEach((id, i) => buf.writeUInt32LE(id, i * 4))
        fs.writeFileSync(filename + '_tokens_ids.bin', buf)
        return Promise.resolve(result)
    }
    
    return fetch(
        RPC_URL,
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
    .then(
        _ => {
            if (_.ok) return _.json()
            throw 'respond not ok'
        },
        _ => {
            throw _.cause?.message || 'failed fetch'
        }
    )    
    .then(responds => {
        const failed_indexes = indexes_load.filter(index => !responds.some(_ => _.id == index && _.result && !_.error))
        responds.forEach(respond => {
            if (typeof respond.id == 'number' && respond.result) {
                IDS[respond.id] = parseInt(respond.result, 16)
                if (isNaN(IDS[respond.id])) debugger
                else result.set(respond.id, IDS[respond.id])
            }
        })
        
        return get_tokens_ids_by_indexes(RPC_URL, filename, failed_indexes, result, abort_signal)
    })
    .catch(() => abort_signal?.aborted ? [] : new Promise(resolve => setTimeout(() => resolve(get_tokens_ids_by_indexes(RPC_URL, filename, indexes, result, abort_signal)), 10000)))
}

const get_pairs = (RPC_URL, factory, ids, result, abort_signal) => ids.length == 0
    ? Promise.resolve([])
    : fetch(RPC_URL, {
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
                get_pairs(RPC_URL, factory, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? [] : new Promise(resolve => setTimeout(() => resolve(get_pairs(RPC_URL, factory, ids, result, abort_signal)), 10000)))

const get_tokens = (RPC_URL, ids, result, abort_signal) => ids.length == 0
    ? Promise.resolve(result)
    : fetch(RPC_URL, {
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
            if (respond.result) {
                const token0 = '0x' + respond.result.slice(2 + 64 * 2, 2 + 64 * 3).slice(24)
                const token1 = '0x' + respond.result.slice(2 + 64 * 3, 2 + 64 * 4).slice(24)
                const fee = Number('0x' + respond.result.slice(2 + 64 * 4, 2 + 64 * 5))
                if (token0.length == 42 && token1.length == 42 && fee) {
                    result[respond.id] = {token0, token1, fee}
                    continue
                }
            }
            failed_ids.push(respond.id)
        }

        return failed_ids.length == 0
            ? result
            : new Promise(resolve => setTimeout(() => resolve(
                get_tokens(RPC_URL, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? {} : new Promise(resolve => setTimeout(() => resolve(get_tokens(RPC_URL, ids, result, abort_signal)), 10000)))

const main = ({indexes, factory, RPC_URL, multicall_size, abort_signal, filename}, onpair) => {
    if (fs.existsSync(filename + '_tokens_ids.bin')) {
        buf = fs.readFileSync(filename + '_tokens_ids.bin')
        for (let i = 0; i < buf.length; i += 4)
            IDS.push(buf.readUInt32LE(i))
    }

    
    const chunks = []
    for (let i = 0; i < indexes.length; i += multicall_size)
        chunks.push(indexes.slice(i, i + multicall_size))

    return chunks.reduce((p, indexes, ic) =>
        p
        .then(() => new Promise(y => setTimeout(y, 3000)))
        .then(() =>
            get_tokens_ids_by_indexes(RPC_URL, filename, indexes, new Map(), abort_signal).then(tokens_ids =>
                get_tokens(RPC_URL, [...tokens_ids.values()], {}, abort_signal).then(tokens => //where tokens = {23: {token0: 0x.., token1: 0x, fee: 2500}, }
                    get_pairs(RPC_URL, factory, tokens, {}, abort_signal).then(pairs =>
                        indexes.forEach((index, i) => {
                            var id = tokens_ids.get(index)
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