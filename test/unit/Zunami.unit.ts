import { ethers, waffle, artifacts } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import { MockContract } from 'ethereum-waffle';
import chai from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';
import {duration} from "../integration_tied/utils";

const MIN_LOCK_TIME = duration.seconds(86405);

const { deployMockContract, provider } = waffle;
const [wallet, otherWallet] = provider.getWallets();
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = chai;

export const bn = (num: string | number) => new BigNumber(num);
export const decify = (value: any, decimals: any) =>
    bn(value).times(bn(10).pow(decimals)).integerValue();
export const undecify = (value: any, decimals: any) =>
    bn(value.toString()).dividedBy(bn(10).pow(decimals));
export const tokenify = (value: any) => decify(value, 18);

async function stubToken(decimals: number, admin: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', admin);
    const token = await StubToken.deploy('StubToken', 'StubToken', decimals);
    await token.deployed();
    return token;
}

const mockContract = async (name: string) =>
    deployMockContract(wallet, (await artifacts.readArtifact(name)).abi);

const mockStrategy = async () => mockContract('IStrategy');

const setTotalHoldings = async (strategy: MockContract, holdings: any) =>
    await strategy.mock.totalHoldings.returns(bn(holdings).toFixed());

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Zunami', () => {
    let admin: SignerWithAddress;
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
            decify(tokenAmounts[2], 6).toFixed(),
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
        [admin, alice, bob, carol, rosa] = await ethers.getSigners();

        dai = await stubToken(18, admin);
        usdc = await stubToken(6, admin);
        usdt = await stubToken(6, admin);

        const Zunami = await ethers.getContractFactory('Zunami', admin);
        zunami = await Zunami.deploy([dai.address, usdc.address, usdt.address]);
        await zunami.deployed();
        expect(zunami.address).to.properAddress;
    });

    it('should created rightly', async () => {
        await expect(await zunami.tokens(0)).to.be.equal(dai.address);
        await expect(await zunami.tokens(1)).to.be.equal(usdc.address);
        await expect(await zunami.tokens(2)).to.be.equal(usdt.address);
        await expect(await zunami.decimalsMultipliers(0)).to.be.equal(1);
        await expect(await zunami.decimalsMultipliers(1)).to.be.equal(10 ** 12);
        await expect(await zunami.decimalsMultipliers(2)).to.be.equal(10 ** 12);

        await expect(await zunami.totalDeposited()).to.be.equal(0);
        await expect(await zunami.launched()).to.be.equal(false);

        await expect(await zunami.FEE_DENOMINATOR()).to.be.equal(1000);
        await expect(await zunami.managementFee()).to.be.equal(100);
        await expect(await zunami.MIN_LOCK_TIME()).to.be.equal(time.duration.days(1).toString());

        await expect(await zunami.paused()).to.be.equal(false);
    });

    it('should be updatable management fee', async () => {
        await expect(await zunami.managementFee()).to.be.equal(100);

        const newManagementFee = 200;
        await zunami.setManagementFee(newManagementFee);

        await expect(await zunami.managementFee()).to.be.equal(newManagementFee);
    });

    it('should not be updatable management fee by wrong value and not by admin', async () => {
        await expectRevert(zunami.setManagementFee(1001), 'Zunami: wrong fee');
        await expectRevert.unspecified(zunami.connect(alice).setManagementFee(1000));
    });

    it('should calculate management fee value', async () => {
        const feeDenom = await zunami.FEE_DENOMINATOR();
        const fee = await zunami.managementFee();

        const calcFee = (value: number) => Math.trunc((value * fee) / feeDenom);

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

        const totalHoldings = strategyHoldings1
            .plus(strategyHoldings2)
            .plus(strategyHoldings3)
            .toFixed();
        await expect(await zunami.totalHoldings()).to.be.equal(totalHoldings);
    });

    it('should move a part of the funds from one strategy to others', async () => {
        const strategy1 = await mockStrategy();
        const strategy2 = await mockStrategy();
        await zunami.addPool(strategy1.address);
        await zunami.addPool(strategy2.address);

        const pid = 0;

        await setTotalHoldings(strategy1, 0);
        await setTotalHoldings(strategy2, 0);

        const tokenBalances = await mintAndApproveTokens(admin, [1, 1, 1]);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const depositedValue1 = tokenify(100);
        const depositedValue2 = tokenify(200);
        await strategy1.mock.deposit.withArgs(tokenBalances).returns(depositedValue1.toFixed());
        await strategy2.mock.deposit.withArgs(tokenBalances).returns(depositedValue2.toFixed());
        await zunami.deposit(tokenBalances);

        const lpShares = ((await zunami.poolInfo(pid)).lpShares * 5_000) / 10_000;

        await strategy1.mock.withdraw
            .withArgs(
                zunami.address,
                ethers.BigNumber.from(lpShares.toString())
                    .mul((1e18).toString())
                    .div((await zunami.poolInfo(pid)).lpShares.toString())
                    .toString(),
                [0, 0, 0],
                WithdrawalType.Base,
                0
            )
            .returns(depositedValue1.div(2));

        await strategy2.mock.deposit.withArgs([0, 0, 0]).returns(depositedValue1.toFixed());
        await zunami.connect(admin).moveFundsBatch([0], [5_000], 1);

        await strategy1.mock.deposit.withArgs([0, 0, 0]).returns(depositedValue2.toFixed());
        await strategy2.mock.withdrawAll.returns();
        await zunami.connect(admin).moveFundsBatch([1], [10_000], 0);
    });

    it('should deposit user funds', async () => {
        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        await setTotalHoldings(strategy, 0);

        let tokenBalances = await mintAndApproveTokens(admin, [1, 1, 1]);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const depositedValue = tokenify(100);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
        await zunami.deposit(tokenBalances);

        const lpShares = depositedValue.toFixed();
        expect(await zunami.totalSupply()).to.be.equal(lpShares);
        expect(await zunami.balanceOf(admin.address)).to.be.equal(lpShares);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(lpShares);
        expect(await zunami.totalDeposited()).to.be.equal(depositedValue.toFixed());

        tokenBalances = await mintAndApproveTokens(admin, [1, 1, 1]);

        const newDepositedValue = tokenify(50);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(newDepositedValue.toFixed());

        const totalSupply = bn((await zunami.totalSupply()).toString());

        const extraHoldings = tokenify(10);
        const enlargedStrategyHoldings = depositedValue.plus(newDepositedValue).plus(extraHoldings);
        await setTotalHoldings(strategy, enlargedStrategyHoldings.toFixed());
        await zunami.deposit(tokenBalances);

        const lpSharesExtra = totalSupply
            .multipliedBy(newDepositedValue)
            .dividedToIntegerBy(enlargedStrategyHoldings)
            .toFixed();
        const lpSharesTotal = bn(lpShares).plus(lpSharesExtra).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(lpSharesTotal);
        expect(await zunami.balanceOf(admin.address)).to.be.equal(lpSharesTotal);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(lpSharesTotal);
        expect(await zunami.totalDeposited()).to.be.equal(
            depositedValue.plus(newDepositedValue).toFixed()
        );
    });

    it('should not withdraw on zero use lpShares balance', async () => {
        const lpShares = tokenify(100);
        const tokenBalances = await mintAndApproveTokens(admin, [1, 1, 1]);

        await expectRevert(
            zunami.withdraw(lpShares.toString(), tokenBalances, WithdrawalType.Base, 0),
            'Zunami: pool not existed!'
        );

        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        await expectRevert(
            zunami.withdraw(lpShares.toString(), tokenBalances, WithdrawalType.Base, 0),
            'Zunami: not enough LP balance'
        );
    });

    it('should withdraw user funds', async () => {
        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        const pid = 0;

        await setTotalHoldings(strategy, 0);

        const tokenBalances = await mintAndApproveTokens(admin, [1, 1, 1]);

        const timeAfterLock = (await time.latest()).add(MIN_LOCK_TIME).toNumber();
        await time.increaseTo(timeAfterLock);

        const depositedValue = tokenify(100);
        await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
        await zunami.deposit(tokenBalances);

        const lpShares = depositedValue.dividedToIntegerBy(2).toFixed();

        await zunami.setAvailableWithdrawalTypes((1).toString()); // OneCoin method disabled

        await strategy.mock.withdraw
            .withArgs(
                admin.address,
                ethers.BigNumber.from(lpShares)
                    .mul((1e18).toString())
                    .div((await zunami.poolInfo(pid)).lpShares.toString())
                    .toString(),
                tokenBalances,
                WithdrawalType.OneCoin,
                0
            )
            .returns(depositedValue.toFixed());

        const totalSupply = bn((await zunami.totalSupply()).toString());
        const totalDeposited = bn((await zunami.totalDeposited()).toString());

        await expectRevert(
            zunami.withdraw(lpShares, tokenBalances, WithdrawalType.OneCoin, 0),
            'Zunami: withdrawal type not available'
        );

        await zunami.setAvailableWithdrawalTypes('2'); // OneCoin method enabled

        await zunami.withdraw(lpShares, tokenBalances, WithdrawalType.OneCoin, 0);

        const newTotalSupply = totalSupply.minus(lpShares).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(newTotalSupply);
        expect(await zunami.balanceOf(admin.address)).to.be.equal(newTotalSupply);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(newTotalSupply);

        const userDeposit = totalDeposited.multipliedBy(lpShares).dividedToIntegerBy(totalSupply);
        const newTotalDeposited = depositedValue.minus(userDeposit).toFixed();
        expect(await zunami.totalDeposited()).to.be.equal(newTotalDeposited);

        await zunami.setAvailableWithdrawalTypes(3); // Base method enabled

        await strategy.mock.withdraw
            .withArgs(
                admin.address,
                ethers.BigNumber.from(lpShares)
                    .mul((1e18).toString())
                    .div((await zunami.poolInfo(pid)).lpShares.toString())
                    .toString(),
                tokenBalances,
                WithdrawalType.Base,
                0
            )
            .returns(depositedValue.toFixed());
        await zunami.withdraw(lpShares, tokenBalances, WithdrawalType.Base, 0);

        expect(await zunami.totalSupply()).to.be.equal(0);
        expect(await zunami.balanceOf(admin.address)).to.be.equal(0);
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);
    });

    it('should delegate deposit', async () => {
        const tokenBalances = await mintAndApproveTokens(admin, [1, 234234234, 123.123123123]);

        await zunami.delegateDeposit(tokenBalances);

        const adminAddress = admin.address;
        expect(await zunami.pendingDepositsToken(adminAddress, 0)).to.be.equal(tokenBalances[0]);
        expect(await zunami.pendingDepositsToken(adminAddress, 1)).to.be.equal(tokenBalances[1]);
        expect(await zunami.pendingDepositsToken(adminAddress, 2)).to.be.equal(tokenBalances[2]);

        const tokenBalances2 = await mintAndApproveTokens(
            admin,
            [123.123123123, 321134123123123123, 1]
        );

        await zunami.delegateDeposit(tokenBalances2);

        const pendingTokenBalances = [
            bn(tokenBalances2[0]).plus(tokenBalances[0]).toFixed(),
            bn(tokenBalances2[1]).plus(tokenBalances[1]).toFixed(),
            bn(tokenBalances2[2]).plus(tokenBalances[2]).toFixed(),
        ];
        expect(await zunami.pendingDepositsToken(adminAddress, 0)).to.be.equal(
            pendingTokenBalances[0]
        );
        expect(await zunami.pendingDepositsToken(adminAddress, 1)).to.be.equal(
            pendingTokenBalances[1]
        );
        expect(await zunami.pendingDepositsToken(adminAddress, 2)).to.be.equal(
            pendingTokenBalances[2]
        );
    });

    it('should complete users pending deposits', async () => {
        const tokenBalance = 100;
        const users = [alice, bob, carol, rosa];

        let totalTokenBalances = [tokenify(0), tokenify(0), tokenify(0)];
        for (const user of users) {
            const tokenBalances = await mintAndApproveTokens(user, [
                tokenBalance,
                tokenBalance,
                tokenBalance,
            ]);
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
        });
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);

        const depositedValue = tokenify(tokenBalance * totalTokenBalances.length * users.length);
        await strategy.mock.deposit
            .withArgs(totalTokenBalances.map((token) => token.toFixed()))
            .returns(depositedValue.toFixed());
        await zunami.completeDeposits(users.map((user) => user.address));

        let totalSupply = depositedValue.toFixed();
        expect(await zunami.totalSupply()).to.be.equal(totalSupply);
        await Promise.all(
            users.map(async (user) => {
                expect(await zunami.balanceOf(user.address)).to.be.equal(
                    tokenify(tokenBalance * totalTokenBalances.length).toFixed()
                );
            })
        );
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(totalSupply);
        expect(await zunami.totalDeposited()).to.be.equal(totalSupply);

        totalTokenBalances = [tokenify(0), tokenify(0), tokenify(0)];
        for (const user of users) {
            const tokenBalances = await mintAndApproveTokens(user, [
                tokenBalance,
                tokenBalance,
                tokenBalance,
            ]);
            await zunami.connect(user).delegateDeposit(tokenBalances);
            for (let i = 0; i < 3; i++) {
                totalTokenBalances[i] = totalTokenBalances[i].plus(tokenBalances[i]);
            }
        }

        await setTotalHoldings(strategy, depositedValue);

        await strategy.mock.deposit
            .withArgs(totalTokenBalances.map((token) => token.toFixed()))
            .returns(depositedValue.toFixed());
        await zunami.completeDeposits(users.map((user) => user.address));

        totalSupply = depositedValue.multipliedBy(2).toFixed();
        expect(await zunami.totalSupply()).to.be.equal(totalSupply);
        await Promise.all(
            users.map(async (user) => {
                expect(await zunami.balanceOf(user.address)).to.be.equal(
                    tokenify(tokenBalance * totalTokenBalances.length * 2).toFixed()
                );
            })
        );
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(totalSupply);
        expect(await zunami.totalDeposited()).to.be.equal(totalSupply);
    });

    it('should delegate withdrawal', async () => {
        const lpAmount = tokenify(100).toFixed();
        const minTokenBalances = [
            tokenify(1).toFixed(),
            decify(234234234, 6).toFixed(),
            decify(123.123123123, 6).toFixed(),
        ];

        await zunami.delegateWithdrawal(lpAmount, minTokenBalances, WithdrawalType.Base, 0);

        const pendingWithdrawal = await zunami.pendingWithdrawals(admin.address);
        expect(pendingWithdrawal.lpShares).to.be.equal(lpAmount);
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
            const tokenBalances = await mintAndApproveTokens(user, [
                tokenBalance,
                tokenBalance,
                tokenBalance,
            ]);
            const depositedValue = tokenify(tokenBalance * totalTokenBalances.length);
            await strategy.mock.deposit.withArgs(tokenBalances).returns(depositedValue.toFixed());
            await setTotalHoldings(strategy, depositedValue.multipliedBy(i));
            await zunami.connect(user).deposit(tokenBalances);
            for (let i = 0; i < 3; i++) {
                totalTokenBalances[i] = totalTokenBalances[i].plus(tokenBalances[i]);
            }
        }

        // withdraw third part of shares
        const lpSharesThird = tokenBalance;
        for (const user of users) {
            const lpAmount = tokenify(lpSharesThird).toFixed();
            const minTokenBalances = [
                tokenify(lpSharesThird).toFixed(),
                decify(lpSharesThird, 6).toFixed(),
                decify(lpSharesThird, 6).toFixed(),
            ];
            await zunami.connect(user).delegateWithdrawal(lpAmount, minTokenBalances, WithdrawalType.Base, 0);
        }

        for (let j = 0; j < users.length; j++) {
            const user = users[j];
            const lpShares = (await zunami.pendingWithdrawals(user.address)).lpShares;
            const poolLpShares = bn((await zunami.poolInfo(pid)).lpShares.toString())
                .minus(lpShares.toString() * j)
                .toFixed();
            await strategy.mock.withdraw
                .withArgs(
                    user.address,
                    lpShares.mul((1e18).toString()).div(poolLpShares).toString(),
                    [
                        tokenify(lpSharesThird).toFixed(),
                        decify(lpSharesThird, 6).toFixed(),
                        decify(lpSharesThird, 6).toFixed(),
                    ],
                    WithdrawalType.Base,
                    0
                )
                .returns(true);
        }
        await zunami.completeWithdrawals(users.map((user) => user.address));

        const supplyAfterWithdrawal = tokenify(
            tokenBalance * (totalTokenBalances.length - 1) * users.length
        ).toFixed();

        expect(await zunami.totalSupply()).to.be.equal(supplyAfterWithdrawal);
        await Promise.all(
            users.map(async (user) => {
                expect(await zunami.balanceOf(user.address)).to.be.equal(
                    tokenify(tokenBalance * (totalTokenBalances.length - 1)).toFixed()
                );
            })
        );
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(supplyAfterWithdrawal);
        expect(await zunami.totalDeposited()).to.be.equal(supplyAfterWithdrawal);

        // withdraw all others shares
        const lpSharesOther = tokenBalance * 2;
        for (const user of users) {
            const lpAmount = tokenify(lpSharesOther).toFixed();
            const minTokenBalances = [
                tokenify(lpSharesOther).toFixed(),
                decify(lpSharesOther, 6).toFixed(),
                decify(lpSharesOther, 6).toFixed(),
            ];
            await zunami.connect(user).delegateWithdrawal(lpAmount, minTokenBalances, WithdrawalType.Base, 0);
        }

        for (let j = 0; j < users.length; j++) {
            const user = users[j];
            const lpShares = (await zunami.pendingWithdrawals(user.address)).lpShares;
            const poolLpShares = bn((await zunami.poolInfo(pid)).lpShares.toString())
                .minus(lpShares.toString() * j)
                .toFixed();
            await strategy.mock.withdraw
                .withArgs(
                    user.address,
                    lpShares.mul((1e18).toString()).div(poolLpShares).toString(),
                    [
                        tokenify(lpSharesOther).toFixed(),
                        decify(lpSharesOther, 6).toFixed(),
                        decify(lpSharesOther, 6).toFixed(),
                    ],
                    WithdrawalType.Base,
                    0
                )
                .returns(true);
        }
        await zunami.completeWithdrawals(users.map((user) => user.address));

        expect(await zunami.totalSupply()).to.be.equal(0);
        await Promise.all(
            users.map(async (user) => {
                expect(await zunami.balanceOf(user.address)).to.be.equal(0);
            })
        );
        expect((await zunami.poolInfo(pid)).lpShares).to.be.equal(0);
        expect(await zunami.totalDeposited()).to.be.equal(0);
    });

    it('should use launched when starting pool', async () => {
        await expect(await zunami.launched()).to.be.equal(false);

        const strategy = await mockStrategy();
        await zunami.addPool(strategy.address);

        expect((await zunami.poolInfo(0)).startTime).to.be.equal((await time.latest()).toNumber());

        await zunami.launch();
        await expect(await zunami.launched()).to.be.equal(true);

        const strategy2 = await mockStrategy();
        const creationTime = await time.latest();
        await zunami.addPool(strategy2.address);

        const transactionDelay = 4; // seconds
        const startTime = creationTime.add(MIN_LOCK_TIME).toNumber() - transactionDelay;
        expect((await zunami.poolInfo(1)).startTime).to.be.equal(startTime);
    });

    it.only('should rebalance randomly initialised pools', async () => {
        const tokens = [100, 100, 100];
        const holdings = 300;
        const createStrategy = async () => {
            const tokenBalances = await mintAndApproveTokens(admin, tokens);
            const strategy = await mockStrategy();
            await zunami.addPool(strategy.address);
            const pid = await zunami.poolCount();
            await zunami.setDefaultDepositPid(pid - 1);
            await setTotalHoldings(strategy, 0);
            await strategy.mock.deposit.withArgs(tokenBalances).returns(tokenify(holdings).toFixed());
            await zunami.deposit(tokenBalances);
            await setTotalHoldings(strategy, tokenify(holdings).toFixed());
            return strategy;
        }

        const poolCount = 20;
        const pids = Array.from(new Array(poolCount).keys());
        const strategies = [];
        for (const pid of pids) {
            strategies.push(await createStrategy());
        }

        expect(await zunami.lpPrice()).to.be.equal(tokenify(1).toFixed());

        for (const strat of strategies) {
            const changePercentage = Math.random() * 2;
            await setTotalHoldings(strat, tokenify(300 * changePercentage).toFixed());
        }

        const lpPrice = await zunami.lpPrice();

        const calcTokenPrice = async (strategy: Contract, pid: number) =>
          await strategy.totalHoldings() / (await zunami.poolInfo(pid)).lpShares;

        let lpPrices = await Promise.all(strategies.map( (strat, index) => calcTokenPrice(strat, index)));
        console.log(lpPrices);

        await zunami.rebalance();

        expect(await zunami.lpPrice()).to.be.equal(lpPrice);

        lpPrices = await Promise.all(strategies.map( (strat, index) => calcTokenPrice(strat, index)));
        console.log(lpPrices);

        const truncate = (value: any, digits: number) => Math.trunc(value * (10 ** digits)) / (10 ** digits);
        for (let i = 0; i < lpPrices.length - 1; i++) {
            expect(truncate(lpPrices[i], 14)).to.be.equal(truncate(lpPrices[i + 1], 14));
        }
    });
});
