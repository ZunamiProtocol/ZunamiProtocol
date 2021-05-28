require('chai').use(require('chai-as-promised')).should();

const pathAndAddress = require('./tools/PathAndAddress.json');
const {Contract, Ticker, faucetEther}= require('./tools/ContractsAndTools.js');

describe('successfully withdraw all deposit usdc', () => {
    const amount = 2e6;

    it('successfully withdraw a deposit', async () => {
        const balanceUsdcBefore = Number(await Contract.usdc.methods
            .balanceOf(pathAndAddress.address.holderUsdc).call());

        await Contract.usdc.methods.approve(Contract.main._address, amount)
            .send({from: pathAndAddress.address.holderUsdc});

        await Contract.main.methods.deposit(pathAndAddress.address.holderUsdc,
            amount,
            Ticker.usdc)
            .send({from: pathAndAddress.address.holderUsdc, gas: '1500000'});

        await Contract.main.methods.withdrawAll(pathAndAddress.address.holderUsdc, Ticker.usdc)
            .send({from: pathAndAddress.address.holderUsdc, gas: '1500000'});

        const balanceUsdcAfter = Number(await Contract.usdc.methods
            .balanceOf(pathAndAddress.address.holderUsdc).call());
        const balansUsdc = await Contract.main.methods
            .depositerBalances(pathAndAddress.address.holderUsdc, Ticker.usdc).call();
        const balansCurve = await Contract.main.methods
            .depositerBalances(pathAndAddress.address.holderUsdc, Ticker.curve).call();
        const balansYearn = await Contract.main.methods
            .depositerBalances(pathAndAddress.address.holderUsdc, Ticker.yearn).call();

        balanceUsdcAfter.should.to.be.within(balanceUsdcBefore - ((amount * 0.1) / 100)
            , balanceUsdcBefore);
        balansUsdc.should.equal('0');
        balansCurve.should.equal('0');
        balansYearn.should.equal('0');
    });
});

describe('Error: withdraw all deposit usdc', () => {
    it('withdraw a deposit with a zero balance', async () => {
        await Contract.main.methods
            .withdrawAll(pathAndAddress.address.holderUsdc, Ticker.usdc)
            .send({from: pathAndAddress.address.holderUsdc, gas: '1500000'})
            .should.be.rejectedWith('Insufficient funds for withdraw');
    });
});
