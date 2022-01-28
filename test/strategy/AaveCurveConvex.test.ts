import { ethers, network } from 'hardhat';
import { waffle } from 'hardhat';
import { expect } from 'chai';
import '@nomiclabs/hardhat-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';
import { TestConstants } from '../constants/TestConstants';

const { expectRevert, time } = require('@openzeppelin/test-helpers');

const { web3 } = require('@openzeppelin/test-helpers/src/setup');
import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';

const provider = waffle.provider;
const MIN_LOCK_TIME = TestConstants.MIN_LOCK_TIME;
const BLOCKS = TestConstants.BLOCKS;
const SKIP_TIMES = TestConstants.SKIP_TIMES;
const daiAddress = TestConstants.daiAddress;
const usdcAddress = TestConstants.usdcAddress;
const usdtAddress = TestConstants.usdtAddress;

describe('AaveCurveConvex', function () {
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

    const daiAccount: string = '0x6F6C07d80D0D433ca389D336e6D1feBEA2489264';
    const usdcAccount: string = '0x6BB273bF25220D13C9b46c6eD3a5408A3bA9Bcc6';
    const usdtAccount: string = '0x67aB29354a70732CDC97f372Be81d657ce8822cd';

    const testCheckSumm = 2950; // 3000 base

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
            await zunami.add(strategy.address); // 0 pool
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

        printBalances();

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

        it('check totalSupply()', async () => {
            let totalSupply = await zunami.totalSupply();
            expect(parseFloat(ethers.utils.formatUnits(totalSupply, 18))).to.gt(1190);
        });

        it('check calcManagementFee(1000)', async () => {
            let calcManagementFee = await zunami.calcManagementFee(1000);
            console.log('calcManagementFee:', calcManagementFee);
        });

        it('check lpPrice()', async () => {
            let lpPrice = await zunami.lpPrice();
            console.log('lpPrice:', lpPrice);
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
        });

        it('claim', async () => {
            await zunami.claimManagementFees(strategy.address);
        });

        it('withdraw', async () => {
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
                expect(SUMM).to.gt(testCheckSumm);
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

        it('complete delegateDeposits to it', async () => {
            await time.increaseTo((await time.latest()).add(MIN_LOCK_TIME));
            await zunami.completeDeposits([alice.address, bob.address, rosa.address], 0);
        });

        it('delegateWithdrawal', async () => {
            for (const user of [alice, bob, rosa]) {
                let zunami_balance = await zunami.balanceOf(user.address);
                await zunami.connect(user).delegateWithdrawal(zunami_balance, [0, 0, 0]);
            }
        });

        it('completeWithdrawals', async () => {
            await zunami.completeWithdrawals(10, 0);
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

        it('Users double delegateDeposit & deposit & withdraw', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .delegateDeposit([
                        web3.utils.toWei('15', 'ether'),
                        web3.utils.toWei('15', 'mwei'),
                        web3.utils.toWei('15', 'mwei'),
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
            await zunami.completeDeposits(
                [alice.address, bob.address, carol.address, rosa.address],
                0
            );
            for (const user of [alice, bob, carol, rosa]) {
                await zunami
                    .connect(user)
                    .withdraw(await zunami.balanceOf(user.address), ['0', '0', '0'], 0);
            }
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

    // ---  STRATEGY ----
    describe('AaveCurveConvex', function () {
        before(async function () {
            let Zunami: ContractFactory = await ethers.getContractFactory('Zunami');
            let deployedStrat: ContractFactory = await ethers.getContractFactory('AaveCurveConvex');
            strategy = await deployedStrat.deploy();
            await strategy.deployed();
            zunami = await Zunami.deploy();
            await zunami.deployed();
            strategy.setZunami(zunami.address);
            strategy.setZunToken(usdc.address);
        });
        testStrategy();
    });
});
