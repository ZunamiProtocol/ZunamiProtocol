const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestMain, Ticker} = require('./tools/tools');

describe('Main withdraw tokens', () => {
    let main;
    let usdc;
    let holderUSDC;
    const amount = 10e6;

    beforeEach(async () => {
        const config = await setupTestMain();
        main = config.main;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });

    it('successfully withdraw a deposit', async () => {
        await usdc.approve(main.address, amount);

        const balanceUsdcBefore = await usdc.balanceOf(holderUSDC);

        await main.deposit(holderUSDC, amount, Ticker.usdc);

        await main.withdrawAll(holderUSDC, 1, 0, Ticker.usdc);

        const balanceUsdcAfter = await usdc.balanceOf(holderUSDC);
        const balansUsdc = await main.depositerBalances(holderUSDC, Ticker.usdc);
        const balansCurve = await main.depositerBalances(holderUSDC, Ticker.curve);
        const balansYearn = await main.depositerBalances(holderUSDC, Ticker.yearn);

        balanceUsdcAfter.should.to.be.within(balanceUsdcBefore - ((amount * 0.1) / 100)
            , balanceUsdcBefore);
        balansUsdc.should.equal('0');
        balansCurve.should.equal('0');
        balansYearn.should.equal('0');
    });

    it('withdraw a deposit with a zero balance', async () => {
        await main.withdrawAll(holderUSDC, 1, 0, Ticker.usdc)
            .should.be.rejectedWith('Insufficient funds for withdrawAll');
    });
});
