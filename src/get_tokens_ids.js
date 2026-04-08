const fs = require('fs')
var buf
const ids = []
if (fs.existsSync('tokens_ids.bin')) {
    buf = fs.readFileSync('tokens_ids.bin')
    for (let i = 0; i < buf.length; i += 4)
        ids.push(buf.readUInt32LE(i))
}

function get_tokens_ids_by_indexes(indexes) {
    const indexes_load = indexes.filter(_ => !ids[_])
    if (indexes_load.length == 0) return Promise.resolve(indexes.map(_ => ids[_]))
    console.log('Cache size', ids.length)
    console.log('Cache size (not empty)', ids.filter(_ => _).length)    
    console.log('Request count', indexes_load.length)
    return fetch(
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
            ids[id] = parseInt(result, 16)
        })
        console.log('Respond length', _.length)
        buf = Buffer.alloc(ids.length * 4)
        ids.forEach((id, i) => buf.writeUInt32LE(id, i * 4))
        fs.writeFileSync('tokens_ids.bin', buf)
        
        return indexes.map(_ => ids[_])
    })
}

module.exports = get_tokens_ids_by_indexes

/*Result:
[
    {"jsonrpc":"2.0","id":0,"result":"0x0000000000000000000000000000000000000000000000000000000000000001"},
    {"jsonrpc":"2.0","id":1,"result":"0x0000000000000000000000000000000000000000000000000000000000000002"},
    {"jsonrpc":"2.0","id":2,"result":"0x0000000000000000000000000000000000000000000000000000000000000003"},
    {"jsonrpc":"2.0","id":3,"result":"0x0000000000000000000000000000000000000000000000000000000000000004"},
    {"jsonrpc":"2.0","id":4,"result":"0x0000000000000000000000000000000000000000000000000000000000000005"},
    {"jsonrpc":"2.0","id":5,"result":"0x0000000000000000000000000000000000000000000000000000000000000006"}]
*/