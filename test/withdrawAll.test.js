const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestMain, Ticker} = require('./tools/tools');

describe('Main withdraw tokens', () => {
    let main;
    let usdc;
    let holderUSDC;

    beforeEach(async () => {
        const config = await setupTestMain();
        main = config.main;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });

    it('successfully withdraw a deposit', async () => {
        const amount = 10e6;

        await usdc.approve(main.address, amount);

        const balanceUsdcBefore = await usdc.balanceOf(holderUSDC);

        await main.deposit(holderUSDC, amount, Ticker.usdc);

        await main.withdrawAll(holderUSDC, 1, 0, Ticker.usdc);

        const balanceUsdcAfter = await usdc.balanceOf(holderUSDC);
        const balanceUsdc = await main.depositerBalances(holderUSDC, Ticker.usdc);
        const balanceCurve = await main.depositerBalances(holderUSDC, Ticker.curve);
        const balanceYearn = await main.depositerBalances(holderUSDC, Ticker.yearn);

        const getTenFractionOfPercent = (number) => {
            return number * 0.001;
        };

        balanceUsdcAfter.should.to.be.within(balanceUsdcBefore - getTenFractionOfPercent(amount)
            , balanceUsdcBefore);
        balanceUsdc.should.equal('0');
        balanceCurve.should.equal('0');
        balanceYearn.should.equal('0');
    });

    it('withdraw a deposit with a zero balance', async () => {
        await main.withdrawAll(holderUSDC, 1, 0, Ticker.usdc)
            .should.be.rejectedWith('Insufficient funds for withdrawAll');
    });
});
