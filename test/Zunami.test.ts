import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';

const { expectRevert, time } = require('@openzeppelin/test-helpers');

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
import { parseUnits } from 'ethers/lib/utils';

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

    function testStrategy() {
        it('should add pool from owner failed', async () => {
            await expectRevert(
                zunami.connect(alice).add(strategy.address),
                'Ownable: caller is not the owner'
            );
        });

        it('should add pool from owner successful complete', async () => {
            await expect(await zunami.add(strategy.address));
            for (const user of [owner, alice, bob, carol, rosa]) {
                await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            }
        });

        it('should updateMinDepositAmount successful complete', async () => {
            await expect(await strategy.updateMinDepositAmount(9974));
        });

        it('should deposit before strategy start failed', async () => {
            await expectRevert(
                zunami.deposit(
                    [
                        parseUnits('1000', 'ether'),
                        parseUnits('1000', 'mwei'),
                        parseUnits('1000', 'mwei'),
                    ],
                    0
                ),
                'Zunami: strategy not started yet!'
            );
        });

        it('should deposit after MIN_LOCK_TIME successful complete', async () => {
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            for (const user of [alice, bob, carol, rosa]) {
                expect(
                    await zunami
                        .connect(user)
                        .deposit(
                            [
                                parseUnits('1000', 'ether'),
                                parseUnits('1000', 'mwei'),
                                parseUnits('1000', 'mwei'),
                            ],
                            0
                        )
                );
            }
        });

        it('should balances after deposit 0', async () => {
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

        it('should users withdraw from 0 pool successful complete', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(
                    await zunami
                        .connect(user)
                        .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0)
                );
            }
        });

        // strategy2
        it('should user balances after withdraw more than testCheckSumm', async () => {
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

        it('should setManagementFee successful complete', async () => {
            expect(await zunami.setManagementFee(20)); //2%
        });

        it('should setLock successful complete', async () => {
            expect(await zunami.setLock(true));
            expect(await zunami.setLock(false));
        });

        it('should updateBuybackFee successful complete', async () => {
            expect(await strategy.updateBuybackFee(5000)); // 50%
            expect(await strategy2.updateBuybackFee(5000)); // 50%
            expect(await strategy2b.updateBuybackFee(5000)); // 50%
            expect(await strategy4.updateBuybackFee(5000)); // 50%
            expect(ethers.utils.formatUnits(await strategy.buybackFee())).equal(
                '0.000000000000005'
            );
            expect(ethers.utils.formatUnits(await strategy2.buybackFee())).equal(
                '0.000000000000005'
            );
            expect(ethers.utils.formatUnits(await strategy2b.buybackFee())).equal(
                '0.000000000000005'
            );
            expect(ethers.utils.formatUnits(await strategy4.buybackFee())).equal(
                '0.000000000000005'
            );
        });

        it('should claimManagementFees successful complete', async () => {
            expect(await zunami.claimManagementFees(strategy.address));
        });

        it('should add one more pool and users deposit to it successful complete', async () => {
            expect(await zunami.add(strategy2.address));
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                expect(
                    await zunami.connect(user).deposit([dai_balance, usdc_balance, usdt_balance], 1)
                );
            }
        });

        it('should totalHoldings more than 1190', async () => {
            let totalHoldings = await zunami.totalHoldings();
            expect(parseFloat(ethers.utils.formatUnits(totalHoldings, 18))).to.gt(1190);
        });

        it('should totalSupply more than 1190', async () => {
            let totalSupply = await zunami.totalSupply();
            expect(parseFloat(ethers.utils.formatUnits(totalSupply, 18))).to.gt(1190);
        });

        it('should calcManagementFee(1000) equal 20', async () => {
            let calcManagementFee = await zunami.calcManagementFee(1000);
            expect(parseFloat(calcManagementFee)).equal(20);
        });

        it('should lpPrice more than 0.99', async () => {
            let lpPrice = await zunami.lpPrice();
            expect(parseFloat(ethers.utils.formatUnits(lpPrice, 18))).to.gt(0.99);
        });

        it('should moveFunds() (update strategy) successful complete', async () => {
            expect(await zunami.moveFunds(1, 0));
        });

        it('should withdraw after moveFunds successful complete', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                expect(
                    await zunami
                        .connect(user)
                        .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0)
                );
            }
        });

        it('should user balances after withdraw more than testCheckSumm', async () => {
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

        it('should delegateDeposit successful complete', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                expect(
                    await zunami
                        .connect(user)
                        .delegateDeposit([dai_balance, usdc_balance, usdt_balance])
                );
            }
        });

        it('should pendingDepositRemove, one user withdraw from pending successful complete', async () => {
            expect(await zunami.connect(carol).pendingDepositRemove());
        });

        it('ahould create new pool (strategy2) and completeDeposits to it successful complete', async () => {
            expect(await zunami.add(strategy2b.address));
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            expect(await zunami.completeDeposits([alice.address, bob.address, rosa.address], 2));
        });

        it('should delegateWithdrawal successful complete', async () => {
            for (const user of [alice, bob, rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                expect(await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]));
            }
        });

        it('should completeWithdrawals successful complete', async () => {
            expect(await zunami.completeWithdrawals(10, 2));
        });

        it('should user balances after withdraw more than testCheckSumm', async () => {
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

        // strategy 4
        it('should delegateDeposit | Strategy 4 successful complete', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                expect(
                    await zunami
                        .connect(user)
                        .delegateDeposit([dai_balance, usdc_balance, usdt_balance])
                );
            }
        });

        it('should one user withdraw from pending | Strategy 4 successful complete', async () => {
            expect(await zunami.connect(carol).pendingDepositRemove());
        });

        it('should create new pool (strategy4) and completeDeposits to it successful complete', async () => {
            expect(await zunami.add(strategy4.address));
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            expect(await zunami.completeDeposits([alice.address, bob.address, rosa.address], 3));
        });

        it('should delegateWithdrawal | Strategy 4 successful complete', async () => {
            for (const user of [alice, bob]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                expect(await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]));
            }
        });

        it('should completeWithdrawals | Strategy 4 successful complete', async () => {
            expect(await zunami.completeWithdrawals(5, 3));
        });

        it('should function updateMinDepositAmount for all strats successful complete', async () => {
            await strategy.updateMinDepositAmount(9970);
            await strategy2.updateMinDepositAmount(9970);
            await strategy2b.updateMinDepositAmount(9970);
            await strategy4.updateMinDepositAmount(9970);
            expect(ethers.utils.formatUnits(await strategy.minDepositAmount())).equal(
                '0.00000000000000997'
            );
            expect(ethers.utils.formatUnits(await strategy2.minDepositAmount())).equal(
                '0.00000000000000997'
            );
            expect(ethers.utils.formatUnits(await strategy2b.minDepositAmount())).equal(
                '0.00000000000000997'
            );
            expect(ethers.utils.formatUnits(await strategy4.minDepositAmount())).equal(
                '0.00000000000000997'
            );
        });

        it('should emergencyWithdraw successful complete', async () => {
            expect(await zunami.emergencyWithdraw());
        });

        it('should delegateWithdrawal after emergencyWithdraw successful complete', async () => {
            for (const user of [rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                expect(await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]));
            }
        });

        it('should completeWithdrawals | Strategy 4 successful complete', async () => {
            expect(await zunami.completeWithdrawals(5, 0));
        });

        it('should user balances after withdraw more than testCheckSumm', async () => {
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

        it('should delegateDeposit successful complete', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                expect(
                    await zunami
                        .connect(user)
                        .delegateDeposit([dai_balance, usdc_balance, usdt_balance])
                );
            }
        });

        it('should completeDeposits to 0,1,2 pool successful complete', async () => {
            expect(await zunami.completeDeposits([bob.address], 0));
            expect(await zunami.completeDeposits([alice.address], 1));
            expect(await zunami.completeDeposits([carol.address, rosa.address], 2));
        });

        it('skip blocks', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
        });

        it('should moveFunds (update strategy) successful complete', async () => {
            expect(await zunami.moveFunds(0, 1));
        });

        it('should moveFundsBatch (update strategy) successful complete', async () => {
            expect(await zunami.moveFundsBatch([1, 2], 0));
        });

        it('should delegateWithdrawal and completeWithdrawals (0) successful complete', async () => {
            for (const user of [alice, bob, rosa, carol]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                expect(await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]));
            }
            // complete
            expect(await zunami.completeWithdrawals(10, 0));
        });

        it('should claim all strats successful complete', async () => {
            for (const strat of [strategy, strategy2, strategy2b, strategy4]) {
                expect(ethers.utils.formatUnits(await strat.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strat.address), 6)
                );
                expect(await zunami.claimManagementFees(strat.address));
            }
        });

        it('should 2 users deposit in diff blocks&pools, skip blocks, withdraw successful complete', async () => {
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
            expect(
                await zunami
                    .connect(alice)
                    .withdraw(
                        aliceBalance < bobBalance ? aliceBalance : bobBalance,
                        ['0', '0', '0'],
                        2
                    )
            );
            expect(
                await zunami
                    .connect(bob)
                    .withdraw(
                        bobBalance < aliceBalance ? bobBalance : aliceBalance,
                        ['0', '0', '0'],
                        1
                    )
            );
        });

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
                .transfer(owner.address, parseUnits('1000000', 'ether'));
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
                .transfer(owner.address, parseUnits('1000000', 'mwei'));
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
                .transfer(owner.address, parseUnits('1000000', 'mwei'));
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
                await usdt.connect(owner).transfer(user.address, parseUnits('1000', 'mwei'));
                await usdc.connect(owner).transfer(user.address, parseUnits('1000', 'mwei'));
                await dai.connect(owner).transfer(user.address, parseUnits('1000', 'ether'));
            }
        }
    });

    // --- START TEST STRATEGIES ---
    // --- MULTI-TEST ----
    describe('Test 4 strategys (Aave, OUSD, USDP, SUSD)', function () {
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
