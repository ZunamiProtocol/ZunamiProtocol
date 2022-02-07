import { ethers, network } from 'hardhat';
import { waffle } from 'hardhat';
import { expect } from 'chai';
import '@nomiclabs/hardhat-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';

const { expectRevert, time } = require('@openzeppelin/test-helpers');

const { web3 } = require('@openzeppelin/test-helpers/src/setup');
import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';

const MIN_LOCK_TIME = time.duration.seconds(86405);
const provider = waffle.provider;
const BLOCKS = 1000;
const SKIP_TIMES = 10;
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const WEEKS_2 = 1209600;
const WEEKS_26 = 15724800;
const WEEKS_52 = 31449600;

describe('ZunStaker', function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let zunStaker: Contract;
    let zun: Contract;
    let vezun: Contract;

    let usdt: Contract;
    const usdtAccount: string = '0x67aB29354a70732CDC97f372Be81d657ce8822cd';

    function testStaker() {
        it('owner send ZUN balance to users', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await zun.transfer(user.address, web3.utils.toWei('1000000', 'ether'));
            }
        });
        it('users try transfer ZUN', async () => {
            await expectRevert(
                zun.connect(alice).transfer(owner.address, web3.utils.toWei('1100000', 'ether')),
                'ERC20: transfer amount exceeds balance'
            );

            for (const user of [alice, bob, carol, rosa]) {
                zun.connect(user).transfer(owner.address, web3.utils.toWei('100', 'ether'));
                zun.connect(owner).transfer(user.address, web3.utils.toWei('100', 'ether'));
            }
        });
        it('users try deposit ZUN > veZUN', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                zun.connect(user).approve(zunStaker.address, web3.utils.toWei('1000000', 'ether'));
                zunStaker.connect(user).deposit(web3.utils.toWei('10000', 'ether'), WEEKS_2);
                zunStaker.connect(user).deposit(web3.utils.toWei('20000', 'ether'), WEEKS_26);
                zunStaker.connect(user).deposit(web3.utils.toWei('30000', 'ether'), WEEKS_52);
            }
        });
        it('users try withdraw veZUN before min time', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                await expectRevert(zunStaker.connect(user).withdraw(0), 'too soon');
            }
        });
        it('users try claim', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
            for (const user of [alice, bob, carol, rosa]) {
                const zunBalBefore = await zun.balanceOf(user.address);
                await zunStaker.connect(user).claim(0);
                const zunBalAfter = await zun.balanceOf(user.address);
                console.log(
                    'claim amount:',
                    ethers.utils.formatUnits(zunBalAfter.sub(zunBalBefore), 18)
                );
            }
        });
        it('users try withdraw veZUN', async () => {
            await time.increaseTo((await time.latest()).add(time.duration.seconds(WEEKS_2 + 1)));
            for (const user of [alice, bob, carol, rosa]) {
                await vezun
                    .connect(user)
                    .approve(zunStaker.address, web3.utils.toWei('1000000', 'ether'));
                await zunStaker.connect(user).withdraw(0);
            }
        });
        it(' skip blocks and read pendings of user', async () => {
            for (var i = 0; i < SKIP_TIMES; i++) {
                await time.advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
            }
            for (const user of [alice, bob, carol, rosa]) {
                const pendingZunTotal = await zunStaker.pendingZunTotal(user.address);
                console.log('pendingZunTotal:', ethers.utils.formatUnits(pendingZunTotal, 18));
            }
        });
        it('getMultiplier', async () => {
            expect(ethers.utils.formatUnits(await zunStaker.getMultiplier(WEEKS_2), 18)).to.equal(
                '1.038356164383561643'
            );
            expect(ethers.utils.formatUnits(await zunStaker.getMultiplier(WEEKS_26), 18)).to.equal(
                '1.498630136986301369'
            );
            expect(ethers.utils.formatUnits(await zunStaker.getMultiplier(WEEKS_52), 18)).to.equal(
                '1.997260273972602739'
            );
        });
        it('users try claimAll', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                const zunBalBeforeClaimAll = await zun.balanceOf(user.address);
                await zunStaker.connect(user).claimAll();
                const zunBalAfterClaimAll = await zun.balanceOf(user.address);
                console.log(
                    'claimAll amount:',
                    ethers.utils.formatUnits(zunBalAfterClaimAll.sub(zunBalBeforeClaimAll), 18)
                );
            }
        });
        it('print balances', async () => {
            for (const user of [alice, bob, carol, rosa]) {
                let zun_balance = await zun.balanceOf(user.address);
                let zun_staked = await zunStaker.totalDepositOf(user.address);
                let vezun_balance = await vezun.balanceOf(user.address);
                let usdt_balance = await usdt.balanceOf(user.address);
                console.log('  ---PRINT BALANCES--- ');
                console.log('  ZUN: ', ethers.utils.formatUnits(zun_balance, 18));
                console.log('  veZun: ', ethers.utils.formatUnits(vezun_balance, 18));
                console.log('  getDepositsOf: ', ethers.utils.formatUnits(zun_staked, 18));
                console.log('  USDT: ', ethers.utils.formatUnits(usdt_balance, 6));
                console.log(
                    '  SUMM : ',
                    parseFloat(ethers.utils.formatUnits(zun_balance, 18)) +
                    parseFloat(ethers.utils.formatUnits(zun_staked, 18))
                );
            }
        });
    }

    describe('ZunStaker - test 01', function () {
        before(async function () {
            let ZUN: ContractFactory = await ethers.getContractFactory('ZUN');
            let VEZUN: ContractFactory = await ethers.getContractFactory('veZUN');
            zun = await ZUN.deploy();
            vezun = await VEZUN.deploy();
            await zun.deployed();
            await vezun.deployed();

            let ZunStaker: ContractFactory = await ethers.getContractFactory('ZunStaker');
            zunStaker = await ZunStaker.deploy(zun.address, vezun.address);
            await zunStaker.deployed();

            [owner, alice, bob, carol, rosa] = await ethers.getSigners();
            usdt = new ethers.Contract(usdtAddress, erc20ABI, owner);
            owner.sendTransaction({
                to: usdtAccount,
                value: ethers.utils.parseEther('10'),
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

            vezun.connect(owner).transferOwnership(zunStaker.address);
        });
        testStaker();
    });
});
