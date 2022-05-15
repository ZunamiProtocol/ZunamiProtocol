import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';

const { expectRevert, time } = require('@openzeppelin/test-helpers');

import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
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
    DEBUG_MODE,
} from './constants/TestConstants';
import { parseUnits } from 'ethers/lib/utils';

import * as config from '../../config.json';

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Zunami', function () {
    let admin: SignerWithAddress;
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

    before(async function () {
        if (!admin) {
            [admin, alice, bob, carol, rosa] = await ethers.getSigners();
            dai = new ethers.Contract(daiAddress, erc20ABI, admin);
            usdc = new ethers.Contract(usdcAddress, erc20ABI, admin);
            usdt = new ethers.Contract(usdtAddress, erc20ABI, admin);

            admin.sendTransaction({
                to: daiAccount,
                value: ethers.utils.parseEther('10'),
            });
            admin.sendTransaction({
                to: usdcAccount,
                value: ethers.utils.parseEther('10'),
            });
            admin.sendTransaction({
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
                .transfer(admin.address, parseUnits('1000000', 'ether'));
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
                .transfer(admin.address, parseUnits('1000000', 'mwei'));
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
                .transfer(admin.address, parseUnits('1000000', 'mwei'));
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [usdtAccount],
            });

            for (const user of [alice, bob, carol, rosa]) {
                let usdtBalance = usdt.balanceOf(user.address);
                let usdcBalance = usdc.balanceOf(user.address);
                let daiBalance = dai.balanceOf(user.address);

                await usdt.connect(user).transfer(admin.address, usdtBalance);
                await usdc.connect(user).transfer(admin.address, usdcBalance);
                await dai.connect(user).transfer(admin.address, daiBalance);
            }

            for (const user of [alice, bob, carol, rosa]) {
                await usdt.connect(admin).transfer(user.address, parseUnits('1000', 'mwei'));
                await usdc.connect(admin).transfer(user.address, parseUnits('1000', 'mwei'));
                await dai.connect(admin).transfer(user.address, parseUnits('1000', 'ether'));
            }
        }
    });

    // --- MULTI-TEST ----
    describe('Test 4 strategys (Aave, OUSD, USDP, SUSD)', async function () {
        before(async function () {
            let Zunami: ContractFactory = await ethers.getContractFactory('Zunami');
            let RebalancingStrat: ContractFactory = await ethers.getContractFactory(
                'RebalancingStrat'
            );
            // let AaveCurveConvex: ContractFactory = await ethers.getContractFactory(
            //     'AaveCurveConvex'
            // );
            let OUSDCurveConvex: ContractFactory = await ethers.getContractFactory(
                'OUSDCurveConvex'
            );
            let USDPCurveConvex: ContractFactory = await ethers.getContractFactory(
                'USDPCurveConvex'
            );
            let SUSDCurveConvex: ContractFactory = await ethers.getContractFactory(
                'SUSDCurveConvex'
            );
            strategy = await RebalancingStrat.deploy();
            // strategy = await AaveCurveConvex.deploy(config);
            strategy2 = await OUSDCurveConvex.deploy(config);
            strategy2b = await USDPCurveConvex.deploy(config);
            strategy4 = await SUSDCurveConvex.deploy(config);
            await strategy.deployed();
            await strategy2.deployed();
            await strategy2b.deployed();
            await strategy4.deployed();
            zunami = await Zunami.deploy([daiAddress, usdcAddress, usdtAddress]);
            await zunami.deployed();
            strategy.setZunami(zunami.address);
            strategy2.setZunami(zunami.address);
            strategy4.setZunami(zunami.address);
            strategy2b.setZunami(zunami.address);

            for (const user of [admin, alice, bob, carol, rosa]) {
                await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            }

            const DEFAULT_ADMIN_ROLE =
                '0x0000000000000000000000000000000000000000000000000000000000000000';
            await zunami.grantRole(DEFAULT_ADMIN_ROLE, admin.address);
            await zunami.updateOperator(carol.address);

            await zunami.launch();
        });

        describe('Test strategy - Aave', function () {
            it('should add pool from admin successful complete', async () => {
                await expectRevert.unspecified(zunami.connect(alice).addPool(strategy.address));
                await expect(await zunami.connect(admin).addPool(strategy.address));

                expect(await zunami.connect(admin).setDefaultDepositPid(0));
                expect(await zunami.connect(admin).setDefaultWithdrawPid(0));
            });

            it('should deposit after MIN_LOCK_TIME successful complete', async () => {
                await expectRevert(
                    zunami.deposit([
                        parseUnits('1000', 'ether'),
                        parseUnits('1000', 'mwei'),
                        parseUnits('1000', 'mwei'),
                    ]),
                    'Zunami: default deposit pool not started yet!'
                );

                await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        await zunami
                            .connect(user)
                            .deposit([
                                parseUnits('1000', 'ether'),
                                parseUnits('1000', 'mwei'),
                                parseUnits('1000', 'mwei'),
                            ])
                    );
                }
                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        parseFloat(
                            ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                        )
                    ).to.gt(testCheckSumm);
                    expect(
                        ethers.utils.formatUnits(await usdt.balanceOf(user.address), 6)
                    ).to.equal('0.0');
                    expect(
                        ethers.utils.formatUnits(await usdc.balanceOf(user.address), 6)
                    ).to.equal('0.0');
                    expect(
                        ethers.utils.formatUnits(await dai.balanceOf(user.address), 18)
                    ).to.equal('0.0');
                }
            });

            it('should users withdraw from pool successful complete', async () => {
                for (var i = 0; i < SKIP_TIMES; i++) {
                    await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
                }

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        await zunami
                            .connect(user)
                            .withdraw(
                                await zunami.balanceOf(user.address),
                                [0, 0, 0],
                                WithdrawalType.Base,
                                0
                            )
                    );
                }

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                    ).to.equal('0.0');
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
        });
        describe('Test strategy2 - OUSD', function () {
            it('should update settings in Zunami & Strats successful complete', async () => {
                expect(await zunami.setManagementFee(20)); //2%
                let calcManagementFee = await zunami.calcManagementFee(1000);
                expect(parseFloat(calcManagementFee)).equal(20);

                const newMinDepositAmount = 9970;
                const minDepositAmountEqual = '0.00000000000000997';
                await strategy.updateMinDepositAmount(newMinDepositAmount);
                await strategy2.updateMinDepositAmount(newMinDepositAmount);
                await strategy2b.updateMinDepositAmount(newMinDepositAmount);
                await strategy4.updateMinDepositAmount(newMinDepositAmount);
                expect(ethers.utils.formatUnits(await strategy.minDepositAmount())).equal(
                    minDepositAmountEqual
                );
                expect(ethers.utils.formatUnits(await strategy2.minDepositAmount())).equal(
                    minDepositAmountEqual
                );
                expect(ethers.utils.formatUnits(await strategy2b.minDepositAmount())).equal(
                    minDepositAmountEqual
                );
                expect(ethers.utils.formatUnits(await strategy4.minDepositAmount())).equal(
                    minDepositAmountEqual
                );
            });

            it('should claimManagementFees, add one more pool and users deposit to it successful complete', async () => {
                expect(await strategy.claimManagementFees());
                expect(await zunami.addPool(strategy2.address));
                expect(await zunami.setDefaultDepositPid(1));
                expect(await zunami.setDefaultWithdrawPid(1));
                expect(parseInt(await zunami.poolCount())).equal(2);
                // expect().equal(2);
                await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
                for (const user of [alice, bob, carol, rosa]) {
                    let usdt_balance = await usdt.balanceOf(user.address);
                    let usdc_balance = await usdc.balanceOf(user.address);
                    let dai_balance = await dai.balanceOf(user.address);
                    expect(
                        await zunami
                            .connect(user)
                            .deposit([dai_balance, usdc_balance, usdt_balance])
                    );
                }
            });

            it('should totalHoldings, totalSupply more than 1190, lpPrice more than 0.99', async () => {
                let totalHoldings = await zunami.totalHoldings();
                expect(parseFloat(ethers.utils.formatUnits(totalHoldings, 18))).to.gt(1190);

                let totalSupply = await zunami.totalSupply();
                expect(parseFloat(ethers.utils.formatUnits(totalSupply, 18))).to.gt(1190);
                if (DEBUG_MODE) {
                    console.log('totalSupply', totalSupply);
                }

                let lpPrice = await zunami.lpPrice();
                expect(parseFloat(ethers.utils.formatUnits(lpPrice, 18))).to.gt(0.99);
            });

            it('should withdraw in one coin successfully', async () => {
                const minAmount = ['0', '0', '0'];
                const withdrawalType = WithdrawalType.OneCoin;
                const tokenIndex = 0;

                const multiplyTokenAmount = (tokenIndex: number) => (tokenIndex === 0 ? 1e18 : 1e6);
                const tokenByIndex = (tokenIndex: number) =>
                    tokenIndex === 0 ? dai : tokenIndex === 1 ? usdc : usdt;
                // Imbalance onecoin withdraw
                const coins = (100 * multiplyTokenAmount(tokenIndex)).toString();
                let tokenUserBalanceBefore = await tokenByIndex(tokenIndex).balanceOf(
                    alice.address
                );
                const tokenAmounts = ['0', '0', '0'];
                tokenAmounts[tokenIndex] = coins;
                const lpAmount = await zunami.connect(alice).calcSharesAmount(tokenAmounts, false);

                await zunami
                    .connect(alice)
                    .withdraw(lpAmount, minAmount, withdrawalType, tokenIndex);

                let tokenUserBalanceAfter = await tokenByIndex(tokenIndex).balanceOf(alice.address);

                const result = 1 - (tokenUserBalanceAfter - tokenUserBalanceBefore) / Number(coins);
                const maxSlippage = 0.005;
                expect(+result.toFixed(3)).to.be.lt(maxSlippage);

                // Base onecoin withdraw
                let userLpBalance = (100 * 1e18).toString();
                tokenUserBalanceBefore = await tokenByIndex(tokenIndex).balanceOf(alice.address);

                const usdtAmountProbe = await zunami
                    .connect(alice)
                    .calcWithdrawOneCoin(userLpBalance, tokenIndex);

                expect(
                    await zunami
                        .connect(alice)
                        .withdraw(userLpBalance, minAmount, withdrawalType, tokenIndex)
                );
            });

            it('should withdraw after moveFunds successful complete', async () => {
                const usdtIndex = 2;

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        await zunami
                            .connect(user)
                            .withdraw(
                                await zunami.balanceOf(user.address),
                                ['0', '0', '0'],
                                WithdrawalType.OneCoin,
                                usdtIndex
                            )
                    );
                }

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                    ).to.equal('0.0');
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
        });
        describe('Test strategy2b - USDP', function () {
            it('should delegate & completeDeposit in new pool, one user removePendingDeposit successful complete', async () => {
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

                expect(await zunami.connect(carol).removePendingDeposit());

                expect(await zunami.addPool(strategy2b.address));
                await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
                expect(await zunami.completeDeposits([alice.address, bob.address, rosa.address]));
            });

            it('should completeWithdrawals successful complete', async () => {
                for (const user of [alice, bob, rosa]) {
                    let zunami_balance = await zunami.balanceOf(user.address);
                    expect(
                        await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0], WithdrawalType.Base, 0)
                    );
                }

                expect(
                    await zunami.completeWithdrawals([alice.address, bob.address, rosa.address])
                );

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                    ).to.equal('0.0');
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
        });
        describe('Test strategy4 - SUSD', function () {
            it('should create new pool, delegate + complete Deposit, removePending, delegate&complete Withdrawals, successful complete', async () => {
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

                expect(await zunami.connect(carol).removePendingDeposit());

                expect(await zunami.connect(admin).addPool(strategy4.address));
                await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
                expect(await zunami.completeDeposits([alice.address, bob.address, rosa.address]));

                for (const user of [alice, bob]) {
                    let zunami_balance = await zunami.balanceOf(user.address);
                    expect(
                        await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0], WithdrawalType.Base, 0)
                    );
                }

                expect(
                    await zunami
                        .connect(admin)
                        .completeWithdrawals([alice.address, bob.address])
                );
                // expect(await zunami.moveFundsBatch([1, 2, 3], 0));
            });

            it('should delegate & completeWithdrawals successful complete', async () => {
                let zunami_balance = await zunami.balanceOf(rosa.address);
                expect(await zunami.connect(rosa).delegateWithdrawal(zunami_balance, [0, 0, 0], WithdrawalType.Base, 0));
                expect(await zunami.connect(admin).completeWithdrawals([rosa.address]));

                for (const user of [alice, bob, carol, rosa]) {
                    expect(
                        ethers.utils.formatUnits(await zunami.balanceOf(user.address), 18)
                    ).to.equal('0.0');
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
        });
        describe('Test Zunami global functions ', function () {
            it('should completeDeposits to 0,1,2, delegateWithdrawal after moveFunds & moveFundsBatch successful complete', async () => {
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

                expect(await zunami.connect(admin).completeDeposits([bob.address]));
                expect(await zunami.connect(admin).completeDeposits([alice.address]));
                expect(await zunami.connect(admin).completeDeposits([carol.address, rosa.address]));

                for (var i = 0; i < SKIP_TIMES; i++) {
                    await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
                }

                const amount100percent = await zunami.FUNDS_DENOMINATOR();
                const amount50percent = amount100percent / 2;
                expect(await zunami.connect(admin).moveFundsBatch([1], [amount50percent], 0));
                expect(await zunami.connect(admin).moveFundsBatch([1], [amount100percent], 0));
                expect(
                    await zunami
                        .connect(admin)
                        .moveFundsBatch([0, 2], [amount100percent, amount100percent], 1)
                );

                for (const user of [alice, bob, rosa, carol]) {
                    let zunami_balance = await zunami.balanceOf(user.address);
                    expect(
                        await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0], WithdrawalType.Base, 0)
                    );
                }
                // complete
                expect(
                    await zunami
                        .connect(admin)
                        .completeWithdrawals([
                            alice.address,
                            bob.address,
                            rosa.address,
                            carol.address,
                        ])
                );
            });

            it('should claim all strats successful complete', async () => {
                expect(ethers.utils.formatUnits(await strategy.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strategy.address), 6)
                );
                expect(ethers.utils.formatUnits(await strategy2.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strategy2.address), 6)
                );
                expect(ethers.utils.formatUnits(await strategy2b.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strategy2b.address), 6)
                );
                expect(ethers.utils.formatUnits(await strategy4.managementFees(), 6)).to.equal(
                    ethers.utils.formatUnits(await usdt.balanceOf(strategy4.address), 6)
                );
                expect(await zunami.claimAllManagementFee());
                await expect(zunami.claimAllManagementFee()).to.emit(
                    zunami,
                    'ClaimedAllManagementFee'
                );
            });

            it('should 2 users deposit in diff blocks&pools, skip blocks, withdraw successful complete', async () => {
                let usdt_balance = await usdt.balanceOf(alice.address);
                let usdc_balance = await usdc.balanceOf(alice.address);
                let dai_balance = await dai.balanceOf(alice.address);
                await zunami.connect(alice).deposit([dai_balance, usdc_balance, usdt_balance]);
                for (var i = 0; i < SKIP_TIMES; i++) {
                    await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
                }
                let usdt_balance_bob = await usdt.balanceOf(bob.address);
                let usdc_balance_bob = await usdc.balanceOf(bob.address);
                let dai_balance_bob = await dai.balanceOf(bob.address);
                await zunami
                    .connect(bob)
                    .deposit([dai_balance_bob, usdc_balance_bob, usdt_balance_bob]);
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
                            WithdrawalType.Base,
                            0
                        )
                );
                expect(
                    await zunami
                        .connect(bob)
                        .withdraw(
                            bobBalance < aliceBalance ? bobBalance : aliceBalance,
                            ['0', '0', '0'],
                            WithdrawalType.Base,
                            0
                        )
                );
            });

            it('test emergency in Zunami', async () => {
                let usdt_admin_before = await usdt.balanceOf(admin.address);
                await usdt.connect(admin).transfer(zunami.address, parseUnits('500', 'mwei'));
                await zunami.connect(admin).withdrawStuckToken(usdt.address);
                let usdt_admin_after = await usdt.balanceOf(admin.address);
                expect(usdt_admin_after == usdt_admin_before);
            });

            it('test emergency in Strats', async () => {
                let usdt_admin_before = await usdt.balanceOf(admin.address);
                await usdt.connect(admin).transfer(zunami.address, parseUnits('500', 'mwei'));
                await zunami.connect(admin).withdrawStuckToken(usdt.address);
                let usdt_admin_after = await usdt.balanceOf(admin.address);
                expect(usdt_admin_after == usdt_admin_before);
                for (const strat of [strategy, strategy2, strategy2b, strategy4]) {
                    let usdt_admin_before = await usdt.balanceOf(admin.address);
                    let stratUsdtBalance = await usdt.balanceOf(strat.address);
                    await strat.connect(admin).withdrawStuckToken(usdt.address);
                    let usdt_admin_after = await usdt.balanceOf(admin.address);
                    expect(usdt_admin_before == usdt_admin_after.add(stratUsdtBalance));
                }
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
        });
    });
});
