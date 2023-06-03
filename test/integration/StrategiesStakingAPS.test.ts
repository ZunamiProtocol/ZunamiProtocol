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

const stakeDaoVaultAbi = [{"inputs":[],"name":"liquidityGauge","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
const crvPool2Abi = [{"stateMutability":"view","type":"function","name":"coins","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}]}];


async function toggleUnlockStakes() {
    const stakingOwner = '0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27';
    const stakingAddress = '0x4edF7C64dAD8c256f6843AcFe56876024b54A1b6';
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

    const staking = new ethers.Contract(stakingAddress, stakingABI, stakingOwnerSigner);

    await staking.connect(stakingOwnerSigner).unlockStakes();
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

                // expect(await uzd.balanceOf(user.getAddress())).to.lt(uzdBefore);
                // expect(await zunamiAPS.balanceOf(user.getAddress())).to.gt(zlpBefore);
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

                await expect(zunamiAPS.connect(user).delegateWithdrawal(zlpAmount, [0, 0, 0]))
                    .to.emit(zunamiAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0]);
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

                await expect(zunamiAPS.connect(user).delegateWithdrawal(zlpAmount, [0, 0, 0]))
                    .to.emit(zunamiAPS, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0]);
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
                    zunamiAPS.connect(user).withdraw(zlpAmount, [0, 0, 0], WithdrawalType.Base, 0)
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
                    zunamiAPS.connect(user).withdraw(zlpAmount, [0, 0, 0], WithdrawalType.OneCoin, 0)
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

    describe("inflate/deflate", function () {
        it("should revert if called by a non-owner", async function () {
            const poolId = 1;
            await expect(strategies[poolId].connect(alice).inflate(100, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(strategies[poolId].connect(alice).deflate(100, 100)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should execute successfully", async function () {
            const poolId = 1;

            const REBALANCER_ROLE = "0xccc64574297998b6c3edf6078cc5e01268465ff116954e3af02ff3a70a730f46";
            const uzdAdmin = new ethers.Contract(addrs.uzd, [
                {"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"}
            ], admin);

            const zunamiAdminAddr = "0xb056B9A45f09b006eC7a69770A65339586231a34";
            await admin.sendTransaction({
                to: zunamiAdminAddr,
                value: ethers.utils.parseEther('1'),
            });
            await network.provider.request({
                method: 'hardhat_impersonateAccount',
                params: [zunamiAdminAddr],
            });
            const zunamiAdminSigner: Signer = ethers.provider.getSigner(zunamiAdminAddr);
            await uzdAdmin
                .connect(zunamiAdminSigner)
                .grantRole(REBALANCER_ROLE, strategies[poolId].address);
            await network.provider.request({
                method: 'hardhat_stopImpersonatingAccount',
                params: [zunamiAdminAddr],
            });

            for (let poolId = 0; poolId < strategies.length; poolId++) {
                await zunamiAPS.addPool(strategies[poolId].address);
            }

            await zunamiAPS.setDefaultDepositPid(poolId);
            await zunamiAPS.setDefaultWithdrawPid(poolId);

            const vaultAddr = await strategies[poolId].vault();
            const vaultLp = new ethers.Contract(vaultAddr, stakeDaoVaultAbi, admin);
            const liquidityGaugeAddr = await vaultLp.liquidityGauge();
            const liquidityGauge = new ethers.Contract(liquidityGaugeAddr, erc20ABI, admin);

            const poolAddr = await strategies[poolId].crvFraxTokenPool();
            const pool = new ethers.Contract(poolAddr, crvPool2Abi, admin);

            const tokenUzdAddr = await pool.coins(0);
            const tokenUzd = new ethers.Contract(tokenUzdAddr, erc20ABI, admin);
            const tokenFraxBPAddr = await pool.coins(1);
            const tokenFraxBP = new ethers.Contract(tokenFraxBPAddr, erc20ABI, admin);

            const big1e18 = BigNumber.from((1e18).toString());
            const approximation = BigNumber.from(2200).mul(big1e18); // slippage less 3000 USD

            const poolUzdBalanceInit = await tokenUzd.balanceOf(poolAddr);
            const poolFraxBpBalanceInit = await tokenFraxBP.balanceOf(poolAddr);

            await uzd.connect(bob).transfer(alice.getAddress(), ethers.utils.parseUnits('500000', 'ether'));
            const uzdAmount = ethers.utils.parseUnits('1000000', 'ether');
            await uzd.connect(alice).approve(zunamiAPS.address, uzdAmount);
            await zunamiAPS.connect(alice).deposit(uzdAmount);

            const poolUzdBalanceBefore = await tokenUzd.balanceOf(poolAddr);
            const poolFraxBpBalanceBefore = await tokenFraxBP.balanceOf(poolAddr);

            expect(poolUzdBalanceBefore.sub(poolUzdBalanceInit)).to.eq(uzdAmount);

            const gaugeBalanceBefore = await liquidityGauge.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceBefore).to.gt(0);

            const inflationAmount = uzdAmount.mul(20).div(100);

            const percentage = 20;
            const percentageBig = BigNumber.from((percentage / 100 * 1e18).toString());

            await strategies[poolId].connect(admin).inflate(percentageBig, BigNumber.from(200000 * 0.99).mul(1e6));

            const poolUzdBalanceInflate = await tokenUzd.balanceOf(poolAddr);
            const poolFraxBpBalanceInflate = await tokenFraxBP.balanceOf(poolAddr);

            expect(poolUzdBalanceInflate.sub(poolUzdBalanceBefore)).to.gt(inflationAmount.sub(approximation));
            expect(poolFraxBpBalanceBefore.sub(poolFraxBpBalanceInflate)).to.gt(inflationAmount.sub(approximation));

            const gaugeBalanceAfterInflate = await liquidityGauge.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceAfterInflate).to.gt(0);
            expect(gaugeBalanceBefore.sub(gaugeBalanceAfterInflate)).to.lt(approximation);

            await strategies[poolId].connect(admin).deflate(percentageBig,  BigNumber.from(200000 * 0.99).mul(1e6));

            const poolUzdBalanceDeflate = await tokenUzd.balanceOf(poolAddr);
            const poolFraxBpBalanceDeflate = await tokenFraxBP.balanceOf(poolAddr);

            expect(poolUzdBalanceInflate.sub(poolUzdBalanceDeflate)).to.gt(inflationAmount.sub(approximation));
            expect(poolFraxBpBalanceDeflate.sub(poolFraxBpBalanceInflate)).to.gt(inflationAmount.sub(approximation));

            const gaugeBalanceAfterDeflate = await liquidityGauge.balanceOf(strategies[poolId].address);

            expect(gaugeBalanceAfterDeflate).to.gt(0);
            expect(gaugeBalanceAfterDeflate.sub(gaugeBalanceAfterInflate)).to.lt(approximation);
        });
    });
});
