import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import '@nomiclabs/hardhat-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';

const { expectRevert, time } = require('@openzeppelin/test-helpers');

const { web3 } = require('@openzeppelin/test-helpers/src/setup');
import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import {
    BLOCKS,
    daiAccount,
    daiAddress,
    MIN_LOCK_TIME,
    provider,
    SKIP_TIMES,
    usdcAccount,
    usdcAddress,
    usdtAccount,
    usdtAddress,
    testCheckSumm,
} from './constants/TestConstants';

describe('Zunami', function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let zunami: Contract;
    let strategy: Contract;
    let strategy2: Contract;
    let strategy2b: Contract;
    let strategy4: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    function printBalances() {
        it('print balances', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                console.log('  ---PRINT BALANCES--- ');
                console.log(
                    '  zunami LP: ',
                    ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                );
                console.log('  usdt: ', ethers.utils.formatUnits(usdt_balance, 6));
                console.log('  usdc: ', ethers.utils.formatUnits(usdc_balance, 6));
                console.log('  dai: ', ethers.utils.formatUnits(dai_balance, 18));
                console.log(
                    '  SUMM : ',
                    parseFloat(ethers.utils.formatUnits(dai_balance, 18)) +
                        parseFloat(ethers.utils.formatUnits(usdc_balance, 6)) +
                        parseFloat(ethers.utils.formatUnits(usdt_balance, 6))
                );
            }
        });
    }

    function testStrategy() {
        it('only the owner can add a pool', async () => {
            await expectRevert(
                zunami.connect(alice).add(strategy.address),
                'Ownable: caller is not the owner'
            );
            await zunami.add(strategy.address);

            for (const user of [owner, alice, bob, carol, rosa]) {
                await usdc
                    .connect(user)
                    .approve(zunami.address, web3.utils.toWei('1000000', 'mwei'));
                await usdt
                    .connect(user)
                    .approve(zunami.address, web3.utils.toWei('1000000', 'mwei'));
                await dai
                    .connect(user)
                    .approve(zunami.address, web3.utils.toWei('1000000', 'ether'));
            }
        });

        it('function updateMinDepositAmount change', async () => {
            await strategy.updateMinDepositAmount(9974);
        });

        it('deposit before strategy started should be fail', async () => {
            await expectRevert(
                zunami.deposit(
                    [
                        web3.utils.toWei('1000', 'ether'),
                        web3.utils.toWei('1000', 'mwei'),
                        web3.utils.toWei('1000', 'mwei'),
                    ],
                    0
                ),
                'Zunami: strategy not started yet!'
            );
        });

        it('deposit after MIN_LOCK_TIME should be successful', async () => {
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .deposit(
                        [
                            web3.utils.toWei('1000', 'ether'),
                            web3.utils.toWei('1000', 'mwei'),
                            web3.utils.toWei('1000', 'mwei'),
                        ],
                        0
                    );
            }
        });

        it('check balances after deposit', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(
                    parseFloat(ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18))
                ).to.gt(testCheckSumm);
                expect(ethers.utils.formatUnits(await usdt.balanceOf(user.address), 6)).to.equal(
                    '0.0'
                );
                expect(ethers.utils.formatUnits(await usdc.balanceOf(user.address), 6)).to.equal(
                    '0.0'
                );
                expect(ethers.utils.formatUnits(await dai.balanceOf(user.address), 18)).to.equal(
                    '0.0'
                );
            }
        });

        it('skip blocks', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
        });

        it('withdraw', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0);
            }
        });

        printBalances();

        // strategy2
        it('check balances after withdraw', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)).to.equal(
                    '0.0'
                );
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                let SUMM =
                    parseFloat(ethers.utils.formatUnits(dai_balance, 18)) +
                    parseFloat(ethers.utils.formatUnits(usdc_balance, 6)) +
                    parseFloat(ethers.utils.formatUnits(usdt_balance, 6));
                expect(SUMM).to.gt(testCheckSumm);
            }
        });

        it('new managmentFee', async () => {
            await zunami.setManagementFee(20); //2%
        });

        it('setLock test', async () => {
            await zunami.setLock(true);
            await zunami.setLock(false);
        });

        it('update buybackfee', async () => {
            await strategy.updateBuybackFee(5000); // 50%
            await strategy2.updateBuybackFee(5000); // 50%
            await strategy2b.updateBuybackFee(5000); // 50%
            await strategy4.updateBuybackFee(5000); // 50%
        });

        it('claim', async () => {
            await zunami.claimManagementFees(strategy.address);
        });

        it('add one more pool and deposit to it', async () => {
            await zunami.add(strategy2.address);
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                await zunami.connect(user).deposit([dai_balance, usdc_balance, usdt_balance], 1);
            }
        });

        it('check totalHoldings()', async () => {
            let totalHoldings = await zunami.totalHoldings();
            expect(parseFloat(ethers.utils.formatUnits(totalHoldings, 18))).to.gt(1190);
            console.log('totalHoldings:', totalHoldings);
        });

        it('check totalSupply()', async () => {
            let totalSupply = await zunami.totalSupply();
            expect(parseFloat(ethers.utils.formatUnits(totalSupply, 18))).to.gt(1190);
            console.log('totalSupply:', totalSupply);
        });

        it('check calcManagementFee(1000)', async () => {
            let calcManagementFee = await zunami.calcManagementFee(1000);
            console.log('calcManagementFee:', calcManagementFee);
        });

        it('check lpPrice()', async () => {
            let lpPrice = await zunami.lpPrice();
            console.log('lpPrice:', lpPrice);
        });

        it('moveFunds() (update strategy) ', async () => {
            await zunami.moveFunds(1, 0);
        });

        it('withdraw after moveFunds()', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0);
            }
        });

        printBalances();

        it('check balances after withdraw', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)).to.equal(
                    '0.0'
                );
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                let SUMM =
                    parseFloat(ethers.utils.formatUnits(dai_balance, 18)) +
                    parseFloat(ethers.utils.formatUnits(usdc_balance, 6)) +
                    parseFloat(ethers.utils.formatUnits(usdt_balance, 6));
                expect(SUMM).to.gt(testCheckSumm); //99.5%
            }
        });

        it('delegateDeposit', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                await zunami
                    .connect(user)
                    .delegateDeposit([dai_balance, usdc_balance, usdt_balance]);
            }
        });

        it('one user withdraw from pending', async () => {
            await zunami.connect(carol).pendingDepositRemove();
        });

        it('create new pool (strategy2) and completeDeposits to it', async () => {
            await zunami.add(strategy2b.address);
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            await zunami.completeDeposits([alice.address, bob.address, rosa.address], 2);
        });

        it('delegateWithdrawal', async () => {
            for (const user of [alice, bob, rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]);
            }
        });

        it('completeWithdrawals', async () => {
            await zunami.completeWithdrawals(10, 2);
        });

        it('check balances after withdraw', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)).to.equal(
                    '0.0'
                );
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                let SUMM =
                    parseFloat(ethers.utils.formatUnits(dai_balance, 18)) +
                    parseFloat(ethers.utils.formatUnits(usdc_balance, 6)) +
                    parseFloat(ethers.utils.formatUnits(usdt_balance, 6));
                expect(SUMM).to.gt(testCheckSumm); //99.5%
            }
        });

        // strategy 4
        it('delegateDeposit | Strategy 4', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                await zunami
                    .connect(user)
                    .delegateDeposit([dai_balance, usdc_balance, usdt_balance]);
            }
        });

        it('one user withdraw from pending | Strategy 4', async () => {
            await zunami.connect(carol).pendingDepositRemove();
        });

        it('create new pool (strategy4) and completeDeposits to it', async () => {
            await zunami.add(strategy4.address);
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            await zunami.completeDeposits([alice.address, bob.address, rosa.address], 3);
        });

        it('delegateWithdrawal | Strategy 4', async () => {
            for (const user of [alice, bob]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]);
            }
        });

        it('completeWithdrawals | Strategy 4', async () => {
            await zunami.completeWithdrawals(5, 3);
        });

        printBalances();

        it('function updateMinDepositAmount for all strats', async () => {
            await strategy.updateMinDepositAmount(9970);
            await strategy2.updateMinDepositAmount(9970);
            await strategy2b.updateMinDepositAmount(9970);
            await strategy4.updateMinDepositAmount(9970);
        });

        it('emergencyWithdraw() test', async () => {
            await zunami.emergencyWithdraw();
        });

        it('delegateWithdrawal after emergencyWithdraw', async () => {
            for (const user of [rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]);
            }
        });

        it('completeWithdrawals | Strategy 4', async () => {
            await zunami.completeWithdrawals(5, 0);
        });

        it('check balances after withraw | Strategy 4', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)).to.equal(
                    '0.0'
                );
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                let SUMM =
                    parseFloat(ethers.utils.formatUnits(dai_balance, 18)) +
                    parseFloat(ethers.utils.formatUnits(usdc_balance, 6)) +
                    parseFloat(ethers.utils.formatUnits(usdt_balance, 6));
                expect(SUMM).to.gt(testCheckSumm); //99.5%
            }
        });

        it('delegateDeposit', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                await zunami
                    .connect(user)
                    .delegateDeposit([dai_balance, usdc_balance, usdt_balance]);
            }
        });

        it('completeDeposits to 0,1,2 pool', async () => {
            await zunami.completeDeposits([bob.address], 0);
            await zunami.completeDeposits([alice.address], 1);
            await zunami.completeDeposits([carol.address, rosa.address], 2);
        });

        it('skip blocks', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
        });

        it('moveFunds() (update strategy) ', async () => {
            await zunami.moveFunds(0, 1);
        });

        it('moveFundsBatch() (update strategy) ', async () => {
            await zunami.moveFundsBatch([1, 2], 0);
        });

        it('delegateWithdrawal and completeWithdrawals (0)', async () => {
            for (const user of [alice, bob, rosa, carol]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]);
            }
            // complete
            await zunami.completeWithdrawals(10, 0);
        });

        it('claim all strats', async () => {
            for (const strat of [strategy, strategy2, strategy2b, strategy4]) {
                expect(ethers.utils.formatUnits(await strat.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strat.address), 6)
                );
                await zunami.claimManagementFees(strat.address);
            }
        });

        printBalances();

        it(' 2 users deposit in diff blocks&pools, skip blocks, withdraw', async () => {
            let usdt_balance = await usdt.balanceOf(alice.address);
            let usdc_balance = await usdc.balanceOf(alice.address);
            let dai_balance = await dai.balanceOf(alice.address);
            await zunami.connect(alice).deposit([dai_balance, usdc_balance, usdt_balance], 1);
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
            let usdt_balance_bob = await usdt.balanceOf(bob.address);
            let usdc_balance_bob = await usdc.balanceOf(bob.address);
            let dai_balance_bob = await dai.balanceOf(bob.address);
            await zunami
                .connect(bob)
                .deposit([dai_balance_bob, usdc_balance_bob, usdt_balance_bob], 2);
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
            // withdraw
            const aliceBalance = await zunami.balanceOf(alice.address);
            const bobBalance = await zunami.balanceOf(bob.address);
            await zunami
                .connect(alice)
                .withdraw(
                    aliceBalance < bobBalance ? aliceBalance : bobBalance,
                    ['0', '0', '0'],
                    2
                );
            await zunami
                .connect(bob)
                .withdraw(
                    bobBalance < aliceBalance ? bobBalance : aliceBalance,
                    ['0', '0', '0'],
                    1
                );
        });

        printBalances();
    }

    before(async function () {
        if (!owner) {
            [owner, alice, bob, carol, rosa] = await ethers.getSigners();
            dai = new ethers.Contract(daiAddress, erc20ABI, owner);
            usdc = new ethers.Contract(usdcAddress, erc20ABI, owner);
            usdt = new ethers.Contract(usdtAddress, erc20ABI, owner);

            owner.sendTransaction({
                to: daiAccount,
                value: ethers.utils.parseEther('10'),
            });
            owner.sendTransaction({
                to: usdcAccount,
                value: ethers.utils.parseEther('10'),
            });
            owner.sendTransaction({
                to: usdtAccount,
                value: ethers.utils.parseEther('10'),
            });

            await network.provider.request({
                method: 'hardhat_impersonateAccount',
                params: [daiAccount],
            });
            const daiAccountSigner: Signer = ethers.provider.getSigner(daiAccount);
            await dai
                .connect(daiAccountSigner)
                .transfer(owner.address, web3.utils.toWei('1000000', 'ether'));
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [daiAccount],
            });

            await network.provider.request({
                method: 'hardhat_impersonateAccount',
                params: [usdcAccount],
            });
            const usdcAccountSigner: Signer = ethers.provider.getSigner(usdcAccount);
            await usdc
                .connect(usdcAccountSigner)
                .transfer(owner.address, web3.utils.toWei('1000000', 'mwei'));
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [usdcAccount],
            });

            await network.provider.request({
                method: 'hardhat_impersonateAccount',
                params: [usdtAccount],
            });
            const usdtAccountSigner: Signer = ethers.provider.getSigner(usdtAccount);
            await usdt
                .connect(usdtAccountSigner)
                .transfer(owner.address, web3.utils.toWei('1000000', 'mwei'));
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [usdtAccount],
            });

            for (const user of [alice, bob, carol, rosa]) {
                let usdtBalance = usdt.balanceOf(user.address);
                let usdcBalance = usdc.balanceOf(user.address);
                let daiBalance = dai.balanceOf(user.address);

                await usdt.connect(user).transfer(owner.address, usdtBalance);
                await usdc.connect(user).transfer(owner.address, usdcBalance);
                await dai.connect(user).transfer(owner.address, daiBalance);
            }

            for (const user of [alice, bob, carol, rosa]) {
                await usdt.connect(owner).transfer(user.address, web3.utils.toWei('1000', 'mwei'));
                await usdc.connect(owner).transfer(user.address, web3.utils.toWei('1000', 'mwei'));
                await dai.connect(owner).transfer(user.address, web3.utils.toWei('1000', 'ether'));
            }
        }
    });

    // --- START TEST STRATEGIES ---
    // --- MULTI-TEST ----
    describe('Zunami - MultiTest', function () {
        before(async function () {
            let Zunami: ContractFactory = await ethers.getContractFactory('Zunami');
            let AaveCurveConvex: ContractFactory = await ethers.getContractFactory(
                'AaveCurveConvex'
            );
            let OUSDCurveConvex: ContractFactory = await ethers.getContractFactory(
                'OUSDCurveConvex'
            );
            let USDPCurveConvex: ContractFactory = await ethers.getContractFactory(
                'USDPCurveConvex'
            );
            let SUSDCurveConvex: ContractFactory = await ethers.getContractFactory(
                'SUSDCurveConvex'
            );
            strategy = await AaveCurveConvex.deploy();
            strategy2 = await OUSDCurveConvex.deploy();
            strategy2b = await USDPCurveConvex.deploy();
            strategy4 = await SUSDCurveConvex.deploy();
            await strategy.deployed();
            await strategy2.deployed();
            await strategy2b.deployed();
            await strategy4.deployed();
            zunami = await Zunami.deploy();
            await zunami.deployed();
            strategy.setZunami(zunami.address);
            strategy2.setZunami(zunami.address);
            strategy4.setZunami(zunami.address);
            strategy2b.setZunami(zunami.address);

            // set mock address for test buyback
            strategy.setZunToken(usdc.address);
            strategy2.setZunToken(usdc.address);
            strategy4.setZunToken(usdc.address);
            strategy2b.setZunToken(usdc.address);
        });
        testStrategy();
    });
});
