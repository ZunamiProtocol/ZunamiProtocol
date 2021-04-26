const {expectRevert} = require('@openzeppelin/test-helpers');
const MainContract = artifacts.require('./Main');
const USDC = artifacts.require('../contracts/mocks/usdc.sol');

contract('Main smart-contract', ([depositer] = accounts) => {
    let usdc;
    let Manager;
    const usdcTicker = web3.utils.fromAscii('usdc');

    beforeEach(async () => {
        usdc = await USDC.new();
        Manager = await MainContract.new();
        const amount = web3.utils.toWei('1000');
        await usdc.faucet(depositer, amount);
        await usdc.approve(Manager.address, amount, {from: depositer});
    });

    describe('Deposit tests', () => {
        it('try deposit stablecoins', async () => {
            const amount = web3.utils.toWei('123');
            await Manager.deposit(depositer, amount, usdcTicker);

            const balance = await Manager.depositerBalances(depositer, usdcTicker);
            assert(balance.toString() === amount, 'Balances are not equal');
        });

        it('try deposit a wrong tocken', async () => {
            const amount = web3.utils.toWei('123');
            const wrongTicker = web3.utils.fromAscii('wrong-ticker');
            await expectRevert(
                Manager.deposit(depositer, amount, wrongTicker),
                'Invalid ticker'
            );
        });
    });

    describe('Withdraw tests', () => {
        it('try withdraw stablecoins', async () => {
            const amount = web3.utils.toWei('123');
            await Manager.deposit(depositer, amount, usdcTicker);
            await Manager.withdraw(depositer, amount, usdcTicker);

            const [depositerBalance, usdcBalance] = await Promise.all([
                Manager.depositerBalances(depositer, usdcTicker),
                usdc.balanceOf(depositer),
            ]);

            assert(depositerBalance.isZero(), 'Balance of platform are not 0');
            assert(usdcBalance.toString() === web3.utils.toWei('1000'),
                'Balance of depositer are not initial');
        });

        it('try withdraw a wrong token', async () => {
            const amount = web3.utils.toWei('123');
            const wrongTicker = web3.utils.fromAscii('wrong-ticker');
            await expectRevert(
                Manager.withdraw(depositer, amount, wrongTicker),
                'Invalid ticker'
            );
        });

        it('try withdraw more than balance', async () => {
            const amountIn = web3.utils.toWei('123');
            const amountOut = web3.utils.toWei('321');

            await Manager.deposit(depositer, amountIn, usdcTicker);

            await expectRevert(
                Manager.withdraw(depositer, amountOut, usdcTicker),
                'insufficient funds');
        });
    });
});
