fetch(
    'https://eth-mainnet.g.alchemy.com/v2/FZBvlPrOxtgaKBBkry3SH0W1IqH4Y5tu',
    {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc:'2.0',
            id:1,
            method:'eth_call',
            params:[
                { to: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', data: '0x18160ddd' }, 'latest'
            ]
        })
    })
.then(_ => _.text())
.then(_ => console.log(_))