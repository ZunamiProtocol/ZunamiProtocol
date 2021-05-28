require('chai').use(require('chai-as-promised')).should();

const address = require('./tools/PathAndAddress.json').address;
const {Contract, Ticker, faucetEther}= require('./tools/ContractsAndTools.js');

const main = Contract.main.methods;
const usdc = Contract.usdc.methods;

describe('successfully withdraw all deposit usdc', () => {
    const amount = 2e6;

    it('successfully withdraw a deposit', async () => {
        const balanceUsdcBefore = Number(await Contract.usdc.methods
            .balanceOf(address.holderUsdc).call());

        await usdc.approve(Contract.main._address, amount).send({from: address.holderUsdc});

        await main.deposit(address.holderUsdc,
            amount, Ticker.usdc).send({from: address.holderUsdc, gas: '1500000'});

        await main.withdrawAll(address.holderUsdc, 1, 0, Ticker.usdc)
            .send({from: address.holderUsdc, gas: '1500000'});

        const balanceUsdcAfter = Number(await usdc.balanceOf(address.holderUsdc).call());
        const balansUsdc = await main.depositerBalances(address.holderUsdc, Ticker.usdc).call();
        const balansCurve = await main.depositerBalances(address.holderUsdc, Ticker.curve).call();
        const balansYearn = await main.depositerBalances(address.holderUsdc, Ticker.yearn).call();

        balanceUsdcAfter.should.to.be.within(balanceUsdcBefore - ((amount * 0.1) / 100)
            , balanceUsdcBefore);
        balansUsdc.should.equal('0');
        balansCurve.should.equal('0');
        balansYearn.should.equal('0');
    });
});

describe('Error: withdraw all deposit usdc', () => {
    it('withdraw a deposit with a zero balance', async () => {
        await main.withdrawAll(address.holderUsdc, 1, 0, Ticker.usdc)
            .send({from: address.holderUsdc, gas: '1500000'})
            .should.be.rejectedWith('Insufficient funds for withdrawAll');
    });
});
