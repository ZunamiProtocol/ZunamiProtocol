import { ethers, waffle, artifacts } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import { MockContract } from "ethereum-waffle";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import BigNumber from "bignumber.js";

const { deployMockContract, provider } = waffle;
const [wallet, otherWallet] = provider.getWallets();

const { expectRevert, time } = require('@openzeppelin/test-helpers');

import chai from 'chai';

const { expect } = chai;

import { MIN_LOCK_TIME } from "./constants/TestConstants";

export const bn = (num: string | number) => new BigNumber(num);
export const decify = (value: any, decimals: any) => bn(value).times(bn(10).pow(decimals)).integerValue();
export const undecify = (value: any, decimals: any) => bn(value.toString()).dividedBy(bn(10).pow(decimals));
export const tokenify = (value: any) => decify(value, 18);

async function stubToken(decimals: number, owner: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', owner);
    const token = (await StubToken.deploy("StubToken", "StubToken", decimals));
    await token.deployed();
    return token;
}

const mockContract = async (name: string) => deployMockContract(
    wallet,
    (await artifacts.readArtifact(name)).abi
);

const mockStrategy = async () => mockContract("IStrategy");

const setTotalHoldings = async (strategy: MockContract, holdings: any) => await strategy.mock.totalHoldings.returns(bn(holdings).toFixed());

describe('Zunami', () => {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let zunami: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    async function mintAndApproveTokens(user: SignerWithAddress, tokenAmounts: number[]) {
        const tokenBalances = [
            tokenify(tokenAmounts[0]).toFixed(),
            decify(tokenAmounts[1], 6).toFixed(),
            decify(tokenAmounts[2], 6).toFixed()
        ];

        await dai.mint(user.address, tokenBalances[0]);
        await dai.connect(user).approve(zunami.address, tokenBalances[0]);

        await usdc.mint(user.address, tokenBalances[1]);
        await usdc.connect(user).approve(zunami.address, tokenBalances[1]);

        await usdt.mint(user.address, tokenBalances[2]);
        await usdt.connect(user).approve(zunami.address, tokenBalances[2]);

        return tokenBalances;
    }

    beforeEach(async () => {
        [owner, alice, bob, carol, rosa] = await ethers.getSigners();

        dai = await stubToken(18, owner);
        usdc = await stubToken(6, owner);
        usdt = await stubToken(6, owner);

        const Zunami = await ethers.getContractFactory('Zunami', owner);
        zunami = (await Zunami.deploy([dai.address, usdc.address, usdt.address]));
        await zunami.deployed();
        expect(zunami.address).to.properAddress;
    });

    it('should created rightly', async () => {
        await expect(await zunami.tokens(0)).to.be.equal(dai.address);
        await expect(await zunami.tokens(1)).to.be.equal(usdc.address);
        await expect(await zunami.tokens(2)).to.be.equal(usdt.address);
        await expect(await zunami.decimalsMultiplierS(0)).to.be.equal(1);
        await expect(await zunami.decimalsMultiplierS(1)).to.be.equal(10**12);
        await expect(await zunami.decimalsMultiplierS(2)).to.be.equal(10**12);

        await expect(await zunami.totalDeposited()).to.be.equal(0);

        await expect(await zunami.FEE_DENOMINATOR()).to.be.equal(1000);
        await expect(await zunami.managementFee()).to.be.equal(10);
        await expect(await zunami.MIN_LOCK_TIME()).to.be.equal(time.duration.days(1).toString());

        await expect(await zunami.paused()).to.be.equal(false);
    });

    it('should be updatable management fee', async () => {
        await expect(await zunami.managementFee()).to.be.equal(10);

        const newManagementFee = 20;
        await zunami.setManagementFee(newManagementFee);

        await expect(await zunami.managementFee()).to.be.equal(newManagementFee);
    });

    it('should not be updatable management fee by wrong value and not by owner', async () => {
        await expectRevert(
            zunami.setManagementFee(1001),
            'Zunami: wrong fee'
        );
        await expectRevert(
            zunami.connect(alice).setManagementFee(1000),
            'Ownable: caller is not the owner'
        );
    });

    it('should calculate management fee value', async () => {
        const feeDenom = await zunami.FEE_DENOMINATOR();
        const fee = await zunami.managementFee();

        const calcFee = (value: number) => Math.trunc(value * fee / feeDenom);

        await expect(await zunami.calcManagementFee(1)).to.be.equal(calcFee(1));
        await expect(await zunami.calcManagementFee(100)).to.be.equal(calcFee(100));
        await expect(await zunami.calcManagementFee(123456)).to.be.equal(calcFee(123456));
        await expect(await zunami.calcManagementFee(1234567890)).to.be.equal(calcFee(1234567890));
    });

    it('should calculate total holdings', async () => {
        await expect(await zunami.totalHoldings()).to.be.equal(0);

        const strategyHoldings1 = decify(1, 0);
        const strategyHoldings2 = decify(1123456, 6);
        const strategyHoldings3 = tokenify(1234231432141234);

        const strategy1 = await mockStrategy();
        const strategy2 = await mockStrategy();
        const strategy3 = await mockStrategy();

        await zunami.addPool(strategy1.address);
        await zunami.addPool(strategy2.address);
        await zunami.addPool(strategy3.address);

        await expect(await zunami.poolCount()).to.be.equal(3);

        await setTotalHoldings(strategy1, strategyHoldings1);
        await setTotalHoldings(strategy2, strategyHoldings2);
        await setTotalHoldings(strategy3, strategyHoldings3);

        const totalHoldings = strategyHoldings1.plus(strategyHoldings2).plus(strategyHoldings3).toFixed();
        await expect(await zunami.totalHoldings()).to.be.equal(totalHoldings);
    });

    it('should deposit user funds', async () => {
        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        await setTotalHoldings(strategy, 0);

        let tokenBalances = await mintAndApproveTokens(owner, [1,1,1]);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const depositedValue = tokenify(100);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
        await zunami.deposit(tokenBalances, pid);

        const lpShares = depositedValue.toFixed();
        expect(await zunami.totalSupply()).to.be.equal(lpShares);
        expect(await zunami.balanceOf(owner.address)).to.be.equal(lpShares);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(lpShares);
        expect(await zunami.totalDeposited()).to.be.equal(depositedValue.toFixed());

        tokenBalances = await mintAndApproveTokens(owner, [1,1,1]);

        const newDepositedValue = tokenify(50);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(newDepositedValue.toFixed());

        const totalSupply = bn((await zunami.totalSupply()).toString());

        const extraHoldings =  tokenify(10);
        const enlargedStrategyHoldings = depositedValue.plus(newDepositedValue).plus(extraHoldings);
        await setTotalHoldings(strategy, enlargedStrategyHoldings.toFixed());
        await zunami.deposit(tokenBalances, pid);

        const lpSharesExtra = totalSupply.multipliedBy(newDepositedValue).dividedToIntegerBy(enlargedStrategyHoldings).toFixed();
        const lpSharesTotal = bn(lpShares).plus(lpSharesExtra).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(lpSharesTotal);
        expect(await zunami.balanceOf(owner.address)).to.be.equal(lpSharesTotal);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(lpSharesTotal);
        expect(await zunami.totalDeposited()).to.be.equal(depositedValue.plus(newDepositedValue).toFixed());
    });

    it('should not withdraw on zero use lpShares balance', async () => {
        const lpShares = tokenify(100);
        const tokenBalances = await mintAndApproveTokens(owner, [1,1,1]);
        const pid = 0;

        await expectRevert(
            zunami.withdraw(lpShares.toString(), tokenBalances, pid),
            'Zunami: pool not existed!'
        );

        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        await expectRevert(
            zunami.withdraw(lpShares.toString(), tokenBalances, pid),
            'Zunami: not enough LP balance'
        );
    });

    it('should withdraw user funds', async () => {
        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        await setTotalHoldings(strategy, 0);

        const tokenBalances = await mintAndApproveTokens(owner, [1,1,1]);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const depositedValue = tokenify(100);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
        await zunami.deposit(tokenBalances, pid);

        const lpShares = depositedValue.dividedToIntegerBy(2).toFixed();

        await strategy.mock.withdraw.withArgs(
            owner.address,
            lpShares,
            (await zunami.poolInfo(pid)).lpShares.toString(),
            tokenBalances
        ).returns(depositedValue.toFixed());

        const totalSupply = bn((await zunami.totalSupply()).toString());
        const totalDeposited = bn((await zunami.totalDeposited()).toString());

        await zunami.withdraw(lpShares, tokenBalances, pid);

        const newTotalSupply = totalSupply.minus(lpShares).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(newTotalSupply);
        expect(await zunami.balanceOf(owner.address)).to.be.equal(newTotalSupply);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(newTotalSupply);

        const userDeposit = totalDeposited.multipliedBy(lpShares).dividedToIntegerBy(totalSupply);
        const newTotalDeposited = depositedValue.minus(userDeposit).toFixed();
        expect(await zunami.totalDeposited()).to.be.equal(newTotalDeposited);

        await strategy.mock.withdraw.withArgs(
            owner.address,
            lpShares,
            (await zunami.poolInfo(pid)).lpShares.toString(),
            tokenBalances
        ).returns(depositedValue.toFixed());
        await zunami.withdraw(lpShares, tokenBalances, pid);

        expect(await zunami.totalSupply()).to.be.equal(0);
        expect(await zunami.balanceOf(owner.address)).to.be.equal(0);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);
    });

    it('should delegate deposit', async () => {
        const tokenBalances = await mintAndApproveTokens(owner, [1, 234234234, 123.123123123]);

        await zunami.delegateDeposit(tokenBalances);

        const ownerAddress = owner.address;
        expect(await zunami.pendingDeposits(ownerAddress, 0)).to.be.equal(tokenBalances[0]);
        expect(await zunami.pendingDeposits(ownerAddress, 1)).to.be.equal(tokenBalances[1]);
        expect(await zunami.pendingDeposits(ownerAddress, 2)).to.be.equal(tokenBalances[2]);

        const tokenBalances2 = await mintAndApproveTokens(owner, [123.123123123, 321134123123123123, 1]);

        await zunami.delegateDeposit(tokenBalances2);

        const pendingTokenBalances = [
            bn(tokenBalances2[0]).plus(tokenBalances[0]).toFixed(),
            bn(tokenBalances2[1]).plus(tokenBalances[1]).toFixed(),
            bn(tokenBalances2[2]).plus(tokenBalances[2]).toFixed(),
        ];
        expect(await zunami.pendingDeposits(ownerAddress, 0)).to.be.equal(pendingTokenBalances[0]);
        expect(await zunami.pendingDeposits(ownerAddress, 1)).to.be.equal(pendingTokenBalances[1]);
        expect(await zunami.pendingDeposits(ownerAddress, 2)).to.be.equal(pendingTokenBalances[2]);
    });

    it('should complete users pending deposits', async () => {
        const tokenBalance = 100;
        const users = [alice, bob, carol, rosa];

        let totalTokenBalances = [tokenify(0), tokenify(0), tokenify(0)];
        for (const user of users) {
            const tokenBalances = await mintAndApproveTokens(user,[tokenBalance, tokenBalance, tokenBalance]);
            await zunami.connect(user).delegateDeposit(tokenBalances);
            for (let i = 0; i < 3; i++) {
                totalTokenBalances[i] = totalTokenBalances[i].plus(tokenBalances[i]);
            }
        }

        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        await setTotalHoldings(strategy, 0);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        expect(await zunami.totalSupply()).to.be.equal(0);
        users.forEach(async (user) => {
            expect(await zunami.balanceOf(user.address)).to.be.equal(0);
        })
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);

        const depositedValue = tokenify(tokenBalance * totalTokenBalances.length * users.length);
        await strategy.mock.deposit.withArgs(totalTokenBalances.map( (token) => token.toFixed() )).returns(depositedValue.toFixed());
        await zunami.completeDeposits( users.map((user) => user.address), pid );

        let totalSupply = depositedValue.toFixed();
        expect(await zunami.totalSupply()).to.be.equal(totalSupply);
        await Promise.all(users.map(async (user) => {
            expect(await zunami.balanceOf(user.address)).to.be.equal(tokenify(tokenBalance * totalTokenBalances.length).toFixed());
        }));
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(totalSupply);
        expect(await zunami.totalDeposited()).to.be.equal(totalSupply);


        totalTokenBalances = [tokenify(0), tokenify(0), tokenify(0)];
        for (const user of users) {
            const tokenBalances = await mintAndApproveTokens(user,[tokenBalance, tokenBalance, tokenBalance]);
            await zunami.connect(user).delegateDeposit(tokenBalances);
            for (let i = 0; i < 3; i++) {
                totalTokenBalances[i] = totalTokenBalances[i].plus(tokenBalances[i]);
            }
        }

        await setTotalHoldings(strategy, depositedValue);

        await strategy.mock.deposit.withArgs(totalTokenBalances.map( (token) => token.toFixed() )).returns(depositedValue.toFixed());
        await zunami.completeDeposits( users.map((user) => user.address), pid );

        totalSupply = depositedValue.multipliedBy(2).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(totalSupply);
        await Promise.all(users.map(async (user) => {
            expect(await zunami.balanceOf(user.address)).to.be.equal(tokenify(tokenBalance * totalTokenBalances.length * 2).toFixed());
        }));
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(totalSupply);
        expect(await zunami.totalDeposited()).to.be.equal(totalSupply);
    });

    it('should delegate withdrawal', async () => {
        const lpAmount = tokenify(100).toFixed();
        const minTokenBalances = [
            tokenify(1).toFixed(),
            decify(234234234, 6).toFixed(),
            decify(123.123123123, 6).toFixed()
        ];

        await zunami.delegateWithdrawal(lpAmount, minTokenBalances);

        const pendingWithdrawal = await zunami.pendingWithdrawals(owner.address);
        expect(pendingWithdrawal).to.be.equal(lpAmount);
        // expect(pendingWithdrawal.minAmounts[0]).to.be.equal(minTokenBalances[0]);
        // expect(pendingWithdrawal.minAmounts[1]).to.be.equal(minTokenBalances[1]);
        // expect(pendingWithdrawal.minAmounts[2]).to.be.equal(minTokenBalances[2]);
    });

    it('should complete users pending withdrawals', async () => {
        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const tokenBalance = 100;
        const users = [alice, bob, carol, rosa];
        let totalTokenBalances = [tokenify(0), tokenify(0), tokenify(0)];
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const tokenBalances = await mintAndApproveTokens(user,[tokenBalance, tokenBalance, tokenBalance]);
            const depositedValue = tokenify(tokenBalance * totalTokenBalances.length);
            await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
            await setTotalHoldings(strategy, depositedValue.multipliedBy(i));
            await zunami.connect(user).deposit(tokenBalances, pid);
            for (let i = 0; i < 3; i++) {
                totalTokenBalances[i] = totalTokenBalances[i].plus(tokenBalances[i]);
            }
        }

        // withdraw third part of shares
        const lpSharesThird =  tokenBalance;
        for (const user of users) {
            const lpAmount = tokenify(lpSharesThird).toFixed();
            const minTokenBalances = [
                tokenify(lpSharesThird).toFixed(),
                decify(lpSharesThird, 6).toFixed(),
                decify(lpSharesThird, 6).toFixed()
            ];
            await zunami.connect(user).delegateWithdrawal(lpAmount, minTokenBalances);
        }

        for (let j = 0; j < users.length; j++) {
            const user = users[j];
            const lpShares = await zunami.pendingWithdrawals(user.address);
            const poolLpShares = bn((await zunami.poolInfo(pid)).lpShares.toString()).minus(lpShares.toString() * j).toFixed();
            await strategy.mock.withdraw.withArgs(
                user.address,
                lpShares.toString(),
                poolLpShares,
                [
                    tokenify(lpSharesThird).toFixed(),
                    decify(lpSharesThird, 6).toFixed(),
                    decify(lpSharesThird, 6).toFixed()
                ]
            ).returns(true);
        }
        await zunami.completeWithdrawals( users.map((user) => user.address), pid );

        const supplyAfterWithdrawal = tokenify(tokenBalance * (totalTokenBalances.length - 1) * users.length).toFixed();

        expect(await zunami.totalSupply()).to.be.equal( supplyAfterWithdrawal );
        await Promise.all(users.map(async (user) => {
            expect(await zunami.balanceOf(user.address)).to.be.equal(tokenify(tokenBalance * (totalTokenBalances.length - 1)).toFixed());
        }));
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(supplyAfterWithdrawal);
        expect(await zunami.totalDeposited()).to.be.equal(supplyAfterWithdrawal);

        // withdraw all others shares
        const lpSharesOther =  tokenBalance * 2;
        for (const user of users) {
            const lpAmount = tokenify(lpSharesOther).toFixed();
            const minTokenBalances = [
                tokenify(lpSharesOther).toFixed(),
                decify(lpSharesOther, 6).toFixed(),
                decify(lpSharesOther, 6).toFixed()
            ];
            await zunami.connect(user).delegateWithdrawal(lpAmount, minTokenBalances);
        }

        for (let j = 0; j < users.length; j++) {
            const user = users[j];
            const lpShares = await zunami.pendingWithdrawals(user.address);
            const poolLpShares = bn((await zunami.poolInfo(pid)).lpShares.toString()).minus(lpShares.toString() * j).toFixed();
            await strategy.mock.withdraw.withArgs(
                user.address,
                lpShares.toString(),
                poolLpShares,
                [
                    tokenify(lpSharesOther).toFixed(),
                    decify(lpSharesOther, 6).toFixed(),
                    decify(lpSharesOther, 6).toFixed()
                ]
            ).returns(true);
        }
        await zunami.completeWithdrawals( users.map((user) => user.address), pid );

        expect(await zunami.totalSupply()).to.be.equal( 0 );
        await Promise.all(users.map(async (user) => {
            expect(await zunami.balanceOf(user.address)).to.be.equal(0);
        }));
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);
    });
});
