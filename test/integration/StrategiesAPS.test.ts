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

describe('Single strategy tests', () => {
    const strategyNames = [
        'UzdFraxCurveStakeDao'
    ];

    const configStakeDao = {
        token: globalConfig.token_aps,
        rewards: [globalConfig.crv, globalConfig.sdt],
    };

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zunamiAPS: Contract;
    let zunami: Contract;
    let usdc: Contract;
    let uzd: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;
    let stableConverter: Contract;

    before(async () => {
        [admin, alice, bob, feeCollector] = await ethers.getSigners();

        zunami = new ethers.Contract(addrs.zunami, zunamiABI, admin);

        uzd = new ethers.Contract(addrs.uzd, uzdABI, admin);

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

        const StableConverterFactory = await ethers.getContractFactory('StableConverter');
        stableConverter = await StableConverterFactory.deploy();
        await stableConverter.deployed();

        const StubElasticRigidVault = await ethers.getContractFactory('StubElasticRigidVault');
        const stubElasticRigidVault = await StubElasticRigidVault.deploy();
        await stubElasticRigidVault.deployed();

        const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManager');
        rewardManager = await RewardManagerFactory.deploy(stableConverter.address, stubElasticRigidVault.address, feeCollector.getAddress());
        await rewardManager.deployed();
    });

    beforeEach(async () => {
        const ZunamiApsFactory = await ethers.getContractFactory('ZunamiAPS');
        zunamiAPS = await ZunamiApsFactory.deploy(addrs.stablecoins.uzd);
        await zunamiAPS.deployed();

        // Init all strategies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);

            const strategy = await factory.deploy(configStakeDao);
            await strategy.deployed();

            strategy.setZunami(zunamiAPS.address);

            strategy.setRewardManager(rewardManager.address);

            strategies.push(strategy);
        }

        for (const user of [admin, alice, bob]) {
            await uzd.connect(user).approve(zunamiAPS.address, parseUnits('1000000', 'ether'));

            await uzd.transfer(user.getAddress(), ethers.utils.parseUnits('10000', 'ether'));
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

            await expect(
                zunamiAPS.completeWithdrawals([alice.getAddress(), bob.getAddress()])
            ).to.emit(zunamiAPS, 'Withdrawn');
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

            await expect(
                zunamiAPS.completeWithdrawalsOptimized([alice.getAddress(), bob.getAddress()])
            ).to.emit(zunamiAPS, 'Withdrawn');
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

                await expect(
                    zunamiAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zunamiAPS, 'Withdrawn');
                zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
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

                await expect(
                    zunamiAPS.connect(user).withdraw(zlpAmount, 0)
                ).to.emit(zunamiAPS, 'Withdrawn');

                zlpAmount = BigNumber.from(await zunamiAPS.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
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

        await ethers.provider.send('evm_increaseTime', [3600 * 24 * 7]);
        await zunamiAPS.autoCompoundAll();

        let tokens;
        let balance;
        for (let strategy of strategies) {
            tokens = [await strategy.token(), ...(await strategy.config()).rewards]
                .map((token) => new ethers.Contract(token, erc20ABI, admin));
            for(let token of tokens) {
                balance = await token.balanceOf(strategy.address);
                expect(balance).to.eq(0);
            }
        }
    });

});
