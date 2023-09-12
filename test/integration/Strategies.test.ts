import { ethers, network, web3 } from 'hardhat';
import { BigNumber, Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import * as addrs from '../address.json';
import * as globalConfig from '../../config.json';

function getMinAmount(): BigNumber[] {
    const zero = ethers.utils.parseUnits('0', 'ether');
    const amount = '1000';
    const dai = ethers.utils.parseUnits(amount, 'ether');
    const usdc = ethers.utils.parseUnits(amount, 'mwei');
    const usdt = ethers.utils.parseUnits(amount, 'mwei');
    return [dai, usdc, usdt, zero, zero];
}

async function increaseChainTime(time: number) {
    await network.provider.send('evm_increaseTime', [time]);
    await network.provider.send('evm_mine');
}

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Single strategy tests', () => {
    const strategyNames = [
        'VaultStrat',
        // 'CrvUSDUsdtCurveStakeDao',
        'ClaimingStrat',
        // 'MIMCurveStakeDao',
        // 'LUSDCurveConvex',
        // 'LUSDFraxCurveConvex',
        // 'ALUSDFraxCurveConvex',
    ];
    enum WithdrawalType {
        Base,
        OneCoin,
    }

    const configConvex = {
        tokens: globalConfig.tokens,
        crv: globalConfig.crv,
        cvx: globalConfig.cvx,
        booster: globalConfig.booster,
    };

    const configStakingConvex = {
        tokens: globalConfig.tokens,
        rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
        booster: globalConfig.stakingBooster,
    };

    const configStakeDao = {
        tokens: globalConfig.tokens,
        rewards: [globalConfig.crv, globalConfig.sdt],
    };

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zunami: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;
    let stableConverter: Contract;

    before(async () => {
        [admin, alice, bob, feeCollector] = await ethers.getSigners();

        // DAI initialization
        dai = new ethers.Contract(addrs.stablecoins.dai, erc20ABI, admin);
        admin.sendTransaction({
            to: addrs.holders.daiHolder,
            value: ethers.utils.parseEther('10'),
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [addrs.holders.daiHolder],
        });
        const daiAccountSigner: Signer = ethers.provider.getSigner(addrs.holders.daiHolder);
        await dai
            .connect(daiAccountSigner)
            .transfer(admin.getAddress(), ethers.utils.parseUnits('1000000', 'ether'));
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [addrs.holders.daiHolder],
        });

        // USDC initialization
        usdc = new ethers.Contract(addrs.stablecoins.usdc, erc20ABI, admin);
        admin.sendTransaction({
            to: addrs.holders.usdcHolder,
            value: ethers.utils.parseEther('10'),
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [addrs.holders.usdcHolder],
        });
        const usdcAccountSigner: Signer = ethers.provider.getSigner(addrs.holders.usdcHolder);
        await usdc
            .connect(usdcAccountSigner)
            .transfer(admin.getAddress(), ethers.utils.parseUnits('1000000', 'mwei'));
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [addrs.holders.usdcHolder],
        });

        // USDT initialization
        usdt = new ethers.Contract(addrs.stablecoins.usdt, erc20ABI, admin);
        admin.sendTransaction({
            to: addrs.holders.usdtHolder,
            value: ethers.utils.parseEther('10'),
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [addrs.holders.usdtHolder],
        });
        const usdtAccountSigner: Signer = ethers.provider.getSigner(addrs.holders.usdtHolder);
        await usdt
            .connect(usdtAccountSigner)
            .transfer(admin.getAddress(), ethers.utils.parseUnits('1000000', 'mwei'));
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [addrs.holders.usdtHolder],
        });

        const StableConverterFactory = await ethers.getContractFactory('StableConverter');
        stableConverter = await StableConverterFactory.deploy();
        await stableConverter.deployed();

        // const StubElasticRigidVault = await ethers.getContractFactory('StubElasticRigidVault');
        // const stubElasticRigidVault = await StubElasticRigidVault.deploy();
        // await stubElasticRigidVault.deployed();

        const RewardManagerFactory = await ethers.getContractFactory('SplitSellingCurveRewardManagerV2');
        rewardManager = await RewardManagerFactory.deploy(stableConverter.address); //stubElasticRigidVault.address, feeCollector.getAddress());
        await rewardManager.deployed();
    });

    beforeEach(async () => {
        const ZunamiFactory = await ethers.getContractFactory('Zunami');
        zunami = await ZunamiFactory.deploy();
        await zunami.deployed();

        await zunami.addTokens(
            [addrs.stablecoins.dai, addrs.stablecoins.usdc, addrs.stablecoins.usdt],
            [1, 12, 12]
        );

        // Init all strategies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);
            const config = strategyName.includes('StakeDao')
                ? configStakeDao
                : strategyName.includes('Staking')
                ? configStakingConvex
                : (strategyName.includes('VaultStrat') || strategyName.includes('ClaimingStrat'))
                ? configStakeDao.tokens
                : configConvex;
            const strategy = await factory.deploy(config);
            await strategy.deployed();

            strategy.setZunami(zunami.address);

            if (!strategyName.includes('VaultStrat') && !strategyName.includes('ClaimingStrat')) {
                strategy.setRewardManager(rewardManager.address);
            }
            if (strategyName.includes('Frax') || strategyName.includes('UsdtCurve')) {
                strategy.setStableConverter(stableConverter.address);
            }

            strategies.push(strategy);
        }

        for (const user of [admin, alice, bob]) {
            await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
            await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));

            await dai.transfer(user.getAddress(), ethers.utils.parseUnits('10000', 'ether'));
            await usdc.transfer(user.getAddress(), ethers.utils.parseUnits('10000', 'mwei'));
            await usdt.transfer(user.getAddress(), ethers.utils.parseUnits('10000', 'mwei'));
        }
    });

    afterEach(async () => {
        strategies = [];
    });

    it('should deposit assets in optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const daiBefore = await dai.balanceOf(user.getAddress());
                const usdcBefore = await usdc.balanceOf(user.getAddress());
                const usdtBefore = await usdt.balanceOf(user.getAddress());

                await expect(zunami.connect(user).delegateDeposit(getMinAmount()))
                    .to.emit(zunami, 'CreatedPendingDeposit')
                    .withArgs(await user.getAddress(), getMinAmount());

                expect(daiBefore).to.gt(await dai.balanceOf(user.getAddress()));
                expect(usdcBefore).to.gt(await usdc.balanceOf(user.getAddress()));
                expect(usdtBefore).to.gt(await usdt.balanceOf(user.getAddress()));
            }
        }

        for (const user of [alice, bob]) {
            expect(await zunami.balanceOf(user.getAddress())).to.eq(0);
        }

        await expect(zunami.completeDeposits([alice.getAddress(), bob.getAddress()])).to.emit(
            zunami,
            'Deposited'
        );

        for (const user of [alice, bob]) {
            expect(await zunami.balanceOf(user.getAddress())).to.gt(0);
        }
    });

    it('should deposit assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const daiBefore = await dai.balanceOf(user.getAddress());
                const usdcBefore = await usdc.balanceOf(user.getAddress());
                const usdtBefore = await usdt.balanceOf(user.getAddress());
                const zlpBefore = await zunami.balanceOf(user.getAddress());

                await expect(zunami.connect(user).deposit(getMinAmount())).to.emit(
                    zunami,
                    'Deposited'
                );

                expect(await dai.balanceOf(user.getAddress())).to.lt(daiBefore);
                expect(await usdc.balanceOf(user.getAddress())).to.lt(usdcBefore);
                expect(await usdt.balanceOf(user.getAddress())).to.lt(usdtBefore);
                expect(await zunami.balanceOf(user.getAddress())).to.gt(zlpBefore);
            }
        }
    });

    it('should withdraw assets in optimize in base mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(getMinAmount())).to.emit(
                    zunami,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zunami
                        .connect(user)
                        .delegateWithdrawal(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.Base, 0)
                )
                    .to.emit(zunami, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0, 0, 0]);
            }

            await expect(
                zunami.completeWithdrawalsBase(
                    [alice.getAddress(), bob.getAddress()],
                    [0, 0, 0, 0, 0]
                )
            ).to.emit(zunami, 'Withdrawn');
        }
    });

    it('should withdraw assets in optimized one coin mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(getMinAmount())).to.emit(
                    zunami,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zunami
                        .connect(user)
                        .delegateWithdrawal(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.OneCoin, 0)
                )
                    .to.emit(zunami, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0, 0, 0]);
            }

            await expect(
                zunami.completeWithdrawalsOneCoin(
                    [alice.getAddress(), bob.getAddress()],
                    [0, 0, 0, 0, 0]
                )
            ).to.emit(zunami, 'Withdrawn');
        }
    });

    it('should withdraw assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(getMinAmount())).to.emit(
                    zunami,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zunami
                        .connect(user)
                        .withdraw(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.Base, 0)
                ).to.emit(zunami, 'Withdrawn');
                zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
            }
        }
    });

    it('should withdraw assets in one coin mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(getMinAmount())).to.emit(
                    zunami,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zunami
                        .connect(user)
                        .withdraw(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.OneCoin, 0)
                ).to.emit(zunami, 'Withdrawn');

                zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
            }
        }
    });

    it('should sell all tokens and rewards after autocompaund', async () => {
        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            await zunami.addPool(strategy.address);

            await zunami.setDefaultDepositPid(i);
            await zunami.setDefaultWithdrawPid(i);

            await expect(zunami.connect(alice).deposit(getMinAmount())).to.emit(
                zunami,
                'Deposited'
            );
        }

        await increaseChainTime(3600 * 24 * 7);

        await zunami.autoCompoundAll();

        let tokens;
        let balance;
        for (let strategy of strategies) {
            if(!strategy.token) {
                continue;
            }
            const config = await strategy.config();
            if(config.rewards) {
                tokens = [await strategy.token(), ...config.rewards]
                  .map((token) => new ethers.Contract(token, erc20ABI, admin));
            } else {
                tokens = [await strategy.token(), config.crv, config.cvx]
                  .map((token) => new ethers.Contract(token, erc20ABI, admin));
            }

            for(let token of tokens) {
                balance = await token.balanceOf(strategy.address);
                expect(balance).to.eq(0);
            }
        }
    });

    it('should moveFunds only to not outdated pool', async () => {
        const poolSrc = 0;
        const poolDst = 1;
        const percentage = 10_000;

        for (let poolId = 0; poolId < 2; poolId++) {
            await zunami.addPool(strategies[poolId].address);
        }

        await zunami.setDefaultDepositPid(poolSrc);
        await zunami.setDefaultWithdrawPid(poolSrc);

        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect(zunami.connect(alice).deposit(getMinAmount())).to.emit(zunami, 'Deposited');
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);

        console.log("(await zunami.poolInfo(poolSrc)).lpShares", (await zunami.poolInfo(poolSrc)).lpShares);
        console.log("(await zunami.poolInfo(poolDst)).lpShares", (await zunami.poolInfo(poolDst)).lpShares);
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.eq(0);
        await expect(zunami.moveFundsBatch([poolSrc], [percentage], poolDst));
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.gt(0);

        console.log("(await zunami.poolInfo(poolSrc)).lpShares", (await zunami.poolInfo(poolSrc)).lpShares);
        console.log("(await zunami.poolInfo(poolDst)).lpShares", (await zunami.poolInfo(poolDst)).lpShares);

        await expect(zunami.moveFundsBatch([poolDst], [percentage], poolSrc));
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.eq(0);

        console.log("(await zunami.poolInfo(poolSrc)).lpShares", (await zunami.poolInfo(poolSrc)).lpShares);
        console.log("(await zunami.poolInfo(poolDst)).lpShares", (await zunami.poolInfo(poolDst)).lpShares);
    });
});
