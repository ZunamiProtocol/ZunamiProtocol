import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';

const { time } = require('@openzeppelin/test-helpers');

import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
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
} from '../constants/TestConstants';
import { parseUnits } from 'ethers/lib/utils';

const STRAT = 'IronBank';
const STRATEGY_NAME = `${STRAT}CurveConvex`;

import * as config from '../../../config.json';

enum WithdrawalType {
    Base,
    OneCoin,
}

describe(STRATEGY_NAME, function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let zunami: Contract;
    let strategy: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

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
    after(async function () {
        if (DEBUG_MODE) {
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
        }
    });

    // ---  STRATEGY ----
    describe(`Test solo ${STRATEGY_NAME} in Zunami`, function () {
        before(async function () {
            let Zunami: ContractFactory = await ethers.getContractFactory('Zunami');
            let deployedStrat: ContractFactory = await ethers.getContractFactory(STRATEGY_NAME);
            strategy = await deployedStrat.deploy(config);
            await strategy.deployed();
            zunami = await Zunami.deploy([daiAddress, usdcAddress, usdtAddress]);
            await zunami.deployed();
            strategy.setZunami(zunami.address);
            await zunami.launch();
        });

        it('Add pool from owner should be successful', async () => {
            await expect(
                zunami.connect(alice).addPool(strategy.address),
                'Ownable: caller is not the owner'
            ).to.be.reverted;
            expect(await zunami.addPool(strategy.address)); // 0 pool
            for (const user of [owner, alice, bob, carol, rosa]) {
                await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
                await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            }
        });

        it('updateMinDepositAmount should be successful', async () => {
            const newMinDepositAmount = 9974;
            const minDepositAmountEqual = '0.000000000000009974';
            expect(await strategy.updateMinDepositAmount(newMinDepositAmount));
            expect(ethers.utils.formatUnits(await strategy.minDepositAmount())).equal(
                minDepositAmountEqual
            );
        });

        it('deposit after MIN_LOCK_TIME should be successful', async () => {
            await expect(
                zunami.deposit([
                    parseUnits('1000', 'ether'),
                    parseUnits('1000', 'mwei'),
                    parseUnits('1000', 'mwei'),
                ]),
                'Zunami: pool not started yet!'
            ).to.be.reverted;

            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .deposit([
                        parseUnits('1000', 'ether'),
                        parseUnits('1000', 'mwei'),
                        parseUnits('1000', 'mwei'),
                    ]);
            }

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

        it('check and update settings', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
            let totalSupply = await zunami.totalSupply();
            expect(parseFloat(ethers.utils.formatUnits(totalSupply, 18))).to.gt(1190);

            let lpPrice = await zunami.lpPrice();
            expect(parseFloat(ethers.utils.formatUnits(lpPrice, 18))).to.gt(0.99);

            expect(await zunami.setManagementFee(20));
            let calcManagementFee = await zunami.calcManagementFee(1000);
            expect(parseFloat(calcManagementFee)).equal(20);
            expect(await zunami.pause());
            expect(await zunami.unpause());
        });

        it('claimManagementFees should be successful', async () => {});

        it('users withdraw from zunami after claim should be successful', async () => {
            expect(await strategy.claimManagementFees());
            for (const user of [alice, bob, carol, rosa]) {
                expect(
                    await zunami
                        .connect(user)
                        .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0, 0)
                );
            }

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

        it('deposit, remove user from it, complete, withdraw should be successful', async () => {
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
            expect(await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME)));
            expect(await zunami.completeDeposits([alice.address, bob.address, rosa.address]));
            for (const user of [alice, bob, rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                expect(await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0], WithdrawalType.Base, 0));
            }
            expect(await zunami.completeWithdrawals([alice.address, bob.address, rosa.address]));
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

        it('Users double delegateDeposit, deposit, withdraw should be successful', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .delegateDeposit([
                        parseUnits('15', 'ether'),
                        parseUnits('15', 'mwei'),
                        parseUnits('15', 'mwei'),
                    ]);
            }
            for (const user of [alice, bob, carol, rosa]) {
                let usdt_balance = await usdt.balanceOf(user.address);
                let usdc_balance = await usdc.balanceOf(user.address);
                let dai_balance = await dai.balanceOf(user.address);
                await zunami
                    .connect(user)
                    .delegateDeposit([dai_balance, usdc_balance, usdt_balance]);
            }
            await zunami.completeDeposits([
                alice.address,
                bob.address,
                carol.address,
                rosa.address,
            ]);
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0, 0);
            }

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
    });
});
