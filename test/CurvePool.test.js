const {expect} = require('chai');

const pathAndAddress = require('./PathAndAddress.json');
const {Contract, Ticker, faucetEther}= require('./ContractsAndTools.js');

describe('Successful call Main deposit', () => {
    it('Main deposit', async () => {
        const amount = 2e6;


        console.log(await Contract.usdc.methods.balanceOf(pathAndAddress.address.holderUSDC).call());
        
        await Contract.usdc.methods.approve(Contract.main._address, amount)
            .send({from: pathAndAddress.address.holderUSDC});

        await Contract.main.methods.deposit(pathAndAddress.address.holderUSDC,
            amount,
            Ticker.usdc)
            .send({from: pathAndAddress.address.holderUSDC, gas: '1500000'});
        console.log(await Contract.usdc.methods.balanceOf(pathAndAddress.address.holderUSDC).call());

        await Contract.main.methods.withdrawAll(Ticker.usdc)
            .send({from: pathAndAddress.address.holderUSDC, gas: '1500000'})

        // await Contract.main.methods.withdraw(pathAndAddress.address.holderUSDC,
        //     1e6,
        //     Ticker.usdc)
        // .send({from: pathAndAddress.address.holderUSDC, gas: '1500000'})
        console.log(await Contract.usdc.methods.balanceOf(pathAndAddress.address.holderUSDC).call());

    });
});
