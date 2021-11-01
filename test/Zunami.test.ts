import { ethers, network } from 'hardhat';
import { waffle } from 'hardhat';
import { expect } from 'chai';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';
import { advanceBlockTo } from './utils/index';
import { Contract } from '@ethersproject/contracts';
import { abi as erc20ABI } from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';

const SUPPLY = '100000000000000';
const provider = waffle.provider;
const BLOCKS = 1000;
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

describe('Zunami', function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;

    let Zunami: ContractFactory;
    let AaveCurveConvex: ContractFactory;
    let IronBankCurveConvex: ContractFactory;
    let SUSDCurveConvex: ContractFactory;
    let TUSDCurveConvex: ContractFactory;
    let USDNCurveConvex: ContractFactory;
    let MIMCurveConvex: ContractFactory;
    let zunami: Contract;
    let strategy: Contract;
    let referenceBlock: number;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    const daiAccount: string = '0x6F6C07d80D0D433ca389D336e6D1feBEA2489264';
    const usdcAccount: string = '0x6BB273bF25220D13C9b46c6eD3a5408A3bA9Bcc6';
    const usdtAccount: string = '0x67aB29354a70732CDC97f372Be81d657ce8822cd';

    before(async function () {
        [owner, alice, bob, carol] = await ethers.getSigners();

        Zunami = await ethers.getContractFactory('Zunami');
        AaveCurveConvex = await ethers.getContractFactory('AaveCurveConvex');
        SUSDCurveConvex = await ethers.getContractFactory('SUSDCurveConvex');
        TUSDCurveConvex = await ethers.getContractFactory('TUSDCurveConvex');
        USDNCurveConvex = await ethers.getContractFactory('USDNCurveConvex');
        MIMCurveConvex = await ethers.getContractFactory('MIMCurveConvex');
        IronBankCurveConvex = await ethers.getContractFactory(
            'IronBankCurveConvex'
        );
        dai = new ethers.Contract(daiAddress, erc20ABI, owner);
        usdc = new ethers.Contract(usdcAddress, erc20ABI, owner);
        usdt = new ethers.Contract(usdtAddress, erc20ABI, owner);
    });

    beforeEach(async function () {
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
            .transfer(owner.address, '100000000000000000000000');
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [daiAccount],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [usdcAccount],
        });
        const usdcAccountSigner: Signer =
            ethers.provider.getSigner(usdcAccount);
        await usdc
            .connect(usdcAccountSigner)
            .transfer(owner.address, '1000000000000');
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [usdcAccount],
        });

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [usdtAccount],
        });
        const usdtAccountSigner: Signer =
            ethers.provider.getSigner(usdtAccount);
        await usdt
            .connect(usdtAccountSigner)
            .transfer(owner.address, '1000000000000');
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [usdtAccount],
        });
    });

    it('aave deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await AaveCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);

        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');
        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('ironnank deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await IronBankCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');
        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('SUSD deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await SUSDCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');

        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('MIM deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await MIMCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');

        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('MIM deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await MIMCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');

        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('TUSD deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await TUSDCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');

        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('USDN deposit/withraw/profit', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await USDNCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');

        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        await zunami.withdraw(await zunami.balanceOf(owner.address), [
            '0',
            '0',
            '0',
        ]);
        await zunami.claimManagementFees(strategy.address);
    });

    it('zunami update strategy', async () => {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await AaveCurveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);

        await dai.approve(zunami.address, '1000000000000000000000');
        await usdc.approve(zunami.address, '1000000000');
        await usdt.approve(zunami.address, '1000000000');
        await zunami.deposit([
            '1000000000000000000000',
            '1000000000',
            '1000000000',
        ]);

        let strategyIB = await IronBankCurveConvex.deploy();
        await strategyIB.deployed();
        await advanceBlockTo((await provider.getBlockNumber()) + BLOCKS);
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);
    });
});
