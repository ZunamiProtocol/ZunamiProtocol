import { ethers, network, web3 } from 'hardhat';
import { BigNumber, Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import { abi as zunamiABI } from '../../artifacts/contracts/Zunami.sol/Zunami.json';
import { abi as uzdABI } from '../../deployment/abi/UZD.json';
import * as addrs from '../address.json';
import * as globalConfig from '../../config.json';

function getMinAmount(): BigNumber {
    return ethers.utils.parseUnits('1000', 'ether');
}

async function toggleUnlockStakes() {
    const stakingOwner = '0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27';
    const stakingAddresses = [
        '0xb8ebc210bcf78be8ef3f09dd0d8e85fa5e252e86'
    ];
    const stakingABI = [
        {
            inputs: [],
            name: 'unlockStakes',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
        },
    ];
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [stakingOwner],
    });
    const stakingOwnerSigner: Signer = ethers.provider.getSigner(stakingOwner);

    for (const stakingAddress of stakingAddresses) {
        const staking = new ethers.Contract(stakingAddress, stakingABI, stakingOwnerSigner);
        await staking.connect(stakingOwnerSigner).unlockStakes();
    }

    await network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [stakingOwner],
    });
}

async function increaseChainTime(time: number) {
    await network.provider.send('evm_increaseTime', [time]);
    await network.provider.send('evm_mine');
}

async function mintUzdAmount(usdc: Contract, admin: Signer, zunami: Contract, uzd: Contract) {
    const usdcAmount = ethers.utils.parseUnits('1000000', 'mwei');
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
        .transfer(admin.getAddress(), usdcAmount);
    await network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [addrs.holders.usdcHolder],
    });

    // UZD
    await usdc.approve(zunami.address, usdcAmount);
    await zunami.deposit([0, usdcAmount, 0]);

    const zlpAmount = await zunami.balanceOf(admin.getAddress());

    await zunami.approve(uzd.address, zlpAmount);
    await uzd.deposit(zlpAmount, admin.getAddress());
}

describe('Single strategy tests', () => {
    const strategyNames = ['UzdStakingFraxCurveConvex'];
    enum WithdrawalType {
        Base,
        OneCoin,
    }

    const configConvex = {
        token: globalConfig.token_aps,
        crv: globalConfig.crv,
        cvx: globalConfig.cvx,
        booster: globalConfig.booster,
    };

    const configStakingConvex = {
        token: globalConfig.token_aps,
        rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
        booster: globalConfig.stakingBooster,
    };

    const configStakeDao = {
        token: globalConfig.token_aps,
        rewards: [globalConfig.crv, globalConfig.sdt],
    };

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zunami: Contract;
    let zunamiAPS: Contract;
    let uzd: Contract;
    let usdc: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;
    let stableConverter: Contract;

    before(async () => {
        [admin, alice, bob, feeCollector] = await ethers.getSigners();

        zunami = new ethers.Contract(addrs.zunami, zunamiABI, admin);

        uzd = new ethers.Contract(addrs.uzd, uzdABI, admin);

        const StableConverterFactory = await ethers.getContractFactory('StableConverter');
        stableConverter = await StableConverterFactory.deploy();
        await stableConverter.deployed();

        const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManager');
        rewardManager = await RewardManagerFactory.deploy(stableConverter.address);
        await rewardManager.deployed();
    });

    beforeEach(async () => {
        await mintUzdAmount(usdc, admin, zunami, uzd);

        const ZunamiApsFactory = await ethers.getContractFactory('ZunamiAPS');
        zunamiAPS = await ZunamiApsFactory.deploy(addrs.stablecoins.uzd);
        await zunamiAPS.deployed();

        // Init all strategies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);

            let strategy;
            if(strategyName.includes("Vault")) {
                strategy = await factory.deploy(uzd.address);
                await strategy.deployed();
            } else {
                const config = strategyName.includes('StakeDao')
                    ? configStakeDao
                    : strategyName.includes('Staking')
                        ? configStakingConvex
                        : configConvex;

                strategy = await factory.deploy(config);
                await strategy.deployed();

                await strategy.setRewardManager(rewardManager.address);
            }

            await strategy.setZunami(zunamiAPS.address);

            strategies.push(strategy);
        }

        for (const user of [alice, bob]) {
            await uzd.connect(user).approve(zunamiAPS.address, parseUnits('499000', 'ether'));

            await uzd.transfer(user.getAddress(), ethers.utils.parseUnits('499000', 'ether'));
        }
    });

    afterEach(async () => {
        strategies = [];
    });

    it('should deposit assets in optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const uzdBefore = await uzd.balanceOf(user.getAddress());

                await expect(zunamiAPS.connect(user).delegateDeposit(getMinAmount()))
                    .to.emit(zunamiAPS, 'CreatedPendingDeposit')
                    .withArgs(await user.getAddress(), getMinAmount());

                expect(uzdBefore).to.gt(await uzd.balanceOf(user.getAddress()));
            }
        }

        for (const user of [alice, bob]) {
            expect(await zunamiAPS.balanceOf(user.getAddress())).to.eq(0);
        }

        await expect(zunamiAPS.completeDeposits([alice.getAddress(), bob.getAddress()])).to.emit(
            zunamiAPS,
            'Deposited'
        );

        for (const user of [alice, bob]) {
            expect(await zunamiAPS.balanceOf(user.getAddress())).to.gt(0);
        }
    });

    it('should deposit assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                const uzdBefore = await uzd.balanceOf(user.getAddress());
                const zlpBefore = await zunamiAPS.balanceOf(user.getAddress());

                await expect(zunamiAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zunamiAPS,
                    'Deposited'
                );

                expect(await uzd.balanceOf(user.getAddress())).to.lt(uzdBefore);
                expect(await zunamiAPS.balanceOf(user.getAddress())).to.gt(zlpBefore);
            }
        }
    });

    it('should withdraw assets in butch mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunamiAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zunamiAPS,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(zunamiAPS.connect(user).delegateWithdrawal(zlpAmount, 0))
                    .to.emit(zunamiAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, 0);
            }

            await increaseChainTime(60 * 60);

            await toggleUnlockStakes();

            await expect(
                zunamiAPS.completeWithdrawals([alice.getAddress(), bob.getAddress()])
            ).to.emit(zunamiAPS, 'Withdrawn');

            await toggleUnlockStakes();
        }
    });

    it('should withdraw assets in optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunamiAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zunamiAPS,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(zunamiAPS.connect(user).delegateWithdrawal(zlpAmount, 0))
                    .to.emit(zunamiAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, 0);
            }

            await increaseChainTime(60 * 60);

            await toggleUnlockStakes();

            await expect(
                zunamiAPS.completeWithdrawalsOptimized([alice.getAddress(), bob.getAddress()])
            ).to.emit(zunamiAPS, 'Withdrawn');

            await toggleUnlockStakes();
        }
    });

    it('should withdraw assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunamiAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zunamiAPS,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await increaseChainTime(60 * 60);

                await toggleUnlockStakes();

                await expect(
                    zunamiAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zunamiAPS, 'Withdrawn');
                zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);

                await toggleUnlockStakes();
            }
        }
    });

    it('should withdraw assets in one coin mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunamiAPS.addPool(strategies[poolId].address);
            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            for (const user of [alice, bob]) {
                await expect(zunamiAPS.connect(user).deposit(getMinAmount())).to.emit(
                    zunamiAPS,
                    'Deposited'
                );

                let zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await increaseChainTime(60 * 60);

                await toggleUnlockStakes();

                await expect(
                    zunamiAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zunamiAPS, 'Withdrawn');

                zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);

                await toggleUnlockStakes();
            }
        }
    });

    it('should sell all tokens and rewards after autocompaund', async () => {
        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            await zunamiAPS.addPool(strategy.address);

            await zunamiAPS.setDefaultDepositPid(i);
            await zunamiAPS.setDefaultWithdrawPid(i);

            await expect(zunamiAPS.connect(alice).deposit(getMinAmount())).to.emit(
                zunamiAPS,
                'Deposited'
            );
        }

        await increaseChainTime(3600 * 24 * 1);

        await zunamiAPS.autoCompoundAll();

        let token;
        let balance;
        for (let strategy of strategies) {
            token = new ethers.Contract(await strategy.token(), erc20ABI, admin);
            balance = await token.balanceOf(strategy.address);

            expect(balance).to.eq(0);
        }
    });
});
