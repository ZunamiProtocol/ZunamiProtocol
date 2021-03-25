const ZunamiStablecoin = artifacts.require('./ZunamiStablecoin');

contract('ZunamiStablecoin', (accounts) => {
    let zunami;
    beforeEach(async () => {
        zunami = await ZunamiStablecoin.new();
    })

    it('name', async () => {
        const name = await zunami.name();
        assert(name === 'Zunami Stablecoin');
    })

    it('symbol',async () => {
        const symbol = await zunami.symbol();
        assert(symbol === 'ZUSD');
    })

    it('totalSupply',async () => {

       const amountTokenAfterMint = await zunami.totalSupply();
       assert(amountTokenAfterMint.toString() === '0');

       await zunami.mint(accounts[0], 1);
       await zunami.mint(accounts[1], 1);

       const accOneBalance = await zunami.balanceOf(accounts[0]);
       const accTwoBalance = await zunami.balanceOf(accounts[1]);
       assert(accOneBalance.toString() === '1');
       assert(accTwoBalance.toString() === '1');

       const amountTokenBeforeMint = await zunami.totalSupply();

       assert(amountTokenBeforeMint.toString() === '2');

       await zunami.burn(accounts[0], 1);

        const amountTokenBeforeBurn = await zunami.totalSupply();

       assert(amountTokenBeforeBurn.toString() === '1');

    })
})
