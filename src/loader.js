const factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984'
const npm = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
const get_tokens_ids_by_indexes = require('./get_tokens_ids')

const get_pairs = (key, ids, result, abort_signal) => ids.length == 0
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
                get_pairs(key, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? [] : new Promise(resolve => setTimeout(() => resolve(get_pairs(key, ids, result, abort_signal)), 10000)))

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
                get_tokens_ids(key, failed_ids, result, abort_signal)
            ), 10000))
    })
    .catch(() => abort_signal?.aborted ? {} : new Promise(resolve => setTimeout(() => resolve(get_tokens_ids(key, ids, result, abort_signal)), 10000)))

const main = ({ids: indexes, key, multicall_size, abort_signal}, onpair) => {
    const chunks = []
    for (let i = 0; i < indexes.length; i += multicall_size)
        chunks.push(indexes.slice(i, i + multicall_size))

    return chunks.reduce((p, indexes, ic) =>
        p.then(() =>
            get_tokens_ids_by_indexes(indexes).then(tokens_ids =>
                get_tokens(key, tokens_ids, {}, abort_signal).then(tokens => //where tokens = {23: {token0: 0x.., token1: 0x, fee: 2500}, }
                    get_pairs(key, tokens, {}, abort_signal).then(pairs =>
                        indexes.forEach(index => {
                            var id = tokens_ids[index]
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