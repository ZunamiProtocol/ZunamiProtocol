import { ethers, network, web3 } from 'hardhat';
import { BigNumber, Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import * as addrs from '../address.json';
import * as globalConfig from '../../config.json';

function getMinAmount(): BigNumber[] {
    const zero = ethers.utils.parseUnits('0', 'ether');
    const amount = '1.123456789';
    const eth = ethers.utils.parseUnits(amount, 'ether');
    const wEth = ethers.utils.parseUnits(amount, 'ether');
    const frxEth = ethers.utils.parseUnits(amount, 'ether');
    return [eth, wEth, frxEth, zero, zero];
}

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Single strategy tests', () => {
    const strategyNames = [
        'VaultNativeStrat',
        'sEthFraxEthCurveConvex',
        'stEthFraxEthCurveConvex',
    ];
    enum WithdrawalType {
        Base,
        OneCoin,
    }

    const configConvexETH = {
        tokens: globalConfig.tokensETH,
        crv: globalConfig.crv,
        cvx: globalConfig.cvx,
        booster: globalConfig.booster,
    };

    const configStakingConvexETH = {
        tokens: globalConfig.tokensETH,
        rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
        booster: globalConfig.stakingBooster,
    };

    const configStakeDaoETH = {
        tokens: globalConfig.tokensETH,
        rewards: [globalConfig.crv, globalConfig.sdt],
    };

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zunami: Contract;
    let wEth: Contract;
    let frxEth: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;
    let nativeConverter: Contract;

    before(async () => {
        [admin, alice, bob, feeCollector] = await ethers.getSigners();

        // wEth initialization
        const WETH9_ABI = [
            {
                constant: false,
                inputs: [],
                name: 'deposit',
                outputs: [],
                payable: true,
                stateMutability: 'payable',
                type: 'function',
            },
            {
                constant: false,
                inputs: [{ name: 'wad', type: 'uint256' }],
                name: 'withdraw',
                outputs: [],
                payable: false,
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ];
        wEth = new ethers.Contract(addrs.stablecoins.wEth, erc20ABI.concat(WETH9_ABI), admin);
        await wEth.deposit({ value: ethers.utils.parseUnits('1000000', 'ether') });

        // frxEth initialization
        const FRXETH_ABI = [
            {
                inputs: [
                    {
                        internalType: 'address',
                        name: 'm_address',
                        type: 'address',
                    },
                    {
                        internalType: 'uint256',
                        name: 'm_amount',
                        type: 'uint256',
                    },
                ],
                name: 'minter_mint',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ];
        frxEth = new ethers.Contract(addrs.stablecoins.frxEth, erc20ABI.concat(FRXETH_ABI), admin);

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [addrs.holders.frxEthMinter],
        });
        const frxEthAccountSigner: Signer = ethers.provider.getSigner(addrs.holders.frxEthMinter);
        await frxEth
            .connect(frxEthAccountSigner)
            .minter_mint(admin.getAddress(), ethers.utils.parseUnits('1000000', 'ether'));
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [addrs.holders.frxEthMinter],
        });

        const RewardManagerFactory = await ethers.getContractFactory(
            'SplitSellingCurveRewardManagerNativeV2'
        );
        rewardManager = await RewardManagerFactory.deploy();
        await rewardManager.deployed();

        const NativeConverterFactory = await ethers.getContractFactory(
            'FraxEthNativeConverter'
        );
        nativeConverter = await NativeConverterFactory.deploy();
        await nativeConverter.deployed();
    });

    beforeEach(async () => {
        const ZunamiFactory = await ethers.getContractFactory('ZunamiNative');
        zunami = await ZunamiFactory.deploy();
        await zunami.deployed();

        await zunami.addTokens(
            [addrs.stablecoins.wEth, addrs.stablecoins.frxEth],
            [1, 1]
        );

        // Init all strategies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);
            const config = strategyName.includes('StakeDao')
                ? configStakeDaoETH
                : strategyName.includes('Staking')
                    ? configStakingConvexETH
                    : strategyName.includes('VaultNative')
                        ? [addrs.stablecoins.ethCurve, addrs.stablecoins.wEth, addrs.stablecoins.frxEth]
                        : configConvexETH;
            const strategy = await factory.deploy(config);
            await strategy.deployed();

            strategy.setZunami(zunami.address);

            if(!strategyName.includes('VaultNative')) {
                strategy.setRewardManager(rewardManager.address);
                strategy.setNativeConverter(nativeConverter.address);
            }

            strategies.push(strategy);
        }

        for (const user of [admin, alice, bob]) {
            await wEth.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            await frxEth.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));

            await wEth.transfer(user.getAddress(), ethers.utils.parseUnits('1000', 'ether'));
            await frxEth.transfer(user.getAddress(), ethers.utils.parseUnits('1000', 'ether'));
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

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                const ethBefore = await ethers.provider.getBalance(user.getAddress());
                const wEthBefore = await wEth.balanceOf(user.getAddress());
                const frxEthBefore = await frxEth.balanceOf(user.getAddress());

                await expect(zunami.connect(user).delegateDeposit(minAmounts, { value: minAmounts[0] }))
                    .to.emit(zunami, 'CreatedPendingDeposit')
                    .withArgs(await user.getAddress(), minAmounts);

                expect(ethBefore).to.gt(await ethers.provider.getBalance(user.getAddress()));
                expect(wEthBefore).to.gt(await wEth.balanceOf(user.getAddress()));
                expect(frxEthBefore).to.gt(await frxEth.balanceOf(user.getAddress()));
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

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                const ethBefore = await ethers.provider.getBalance(user.getAddress());
                const wEthBefore = await wEth.balanceOf(user.getAddress());
                const frxEthBefore = await frxEth.balanceOf(user.getAddress());
                const zlpBefore = await zunami.balanceOf(user.getAddress());

                await expect(zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })).to.emit(
                    zunami,
                    'Deposited'
                );

                expect(await ethers.provider.getBalance(user.getAddress())).to.lt(ethBefore);
                expect(await wEth.balanceOf(user.getAddress())).to.lt(wEthBefore);
                expect(await frxEth.balanceOf(user.getAddress())).to.lt(frxEthBefore);
                expect(await zunami.balanceOf(user.getAddress())).to.gt(zlpBefore);
            }
        }
    });

    it('should withdraw assets in optimize in base mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })).to.emit(
                    zunami,
                    'Deposited'
                );

                const zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await expect(
                    zunami
                        .connect(user)
                        .delegateWithdrawal(zlpAmount, [0, 0, 0, 0, 0])
                )
                    .to.emit(zunami, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0, 0, 0]);
            }

            await expect(
                zunami.completeWithdrawals(
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

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })).to.emit(
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

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                await expect(zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })).to.emit(
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
        const minAmounts = getMinAmount();
        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            await zunami.addPool(strategy.address);

            await zunami.setDefaultDepositPid(i);
            await zunami.setDefaultWithdrawPid(i);

            await expect(zunami.connect(alice).deposit(minAmounts, { value: minAmounts[0] })).to.emit(
                zunami,
                'Deposited'
            );
        }

        await ethers.provider.send('evm_increaseTime', [3600 * 24 * 7]);
        await zunami.autoCompoundAll();

        let token;
        let balance;
        for (let strategy of strategies) {
            token = new ethers.Contract(await strategy.token(), erc20ABI, admin);
            balance = await token.balanceOf(strategy.address);

            expect(balance).to.eq(0);
        }
    });

    it('should moveFunds only to not outdated pool', async () => {
        const poolSrc = 0;
        const poolDst = 1;
        const veryBigNumber = 1_000_000_000;
        const percentage = 10_000_000_000;

        const minAmounts = getMinAmount();

        for (let poolId = 0; poolId < 2; poolId++) {
            await zunami.addPool(strategies[poolId].address);
        }

        await zunami.setDefaultDepositPid(poolSrc);
        await zunami.setDefaultWithdrawPid(poolSrc);

        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect(zunami.connect(alice).deposit(minAmounts, { value: minAmounts[0] })).to.emit(zunami, 'Deposited');
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);

        await expect(zunami.enablePool(veryBigNumber)).to.be.revertedWith('reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)');

        await expect(zunami.disablePool(poolDst))
            .to.emit(zunami, 'ChangedPoolEnabledStatus')
            .withArgs(strategies[poolDst].address, false);

        await expect((await zunami.poolInfo(poolDst)).enabled).to.be.false;

        await expect(zunami.moveFundsBatch([poolSrc], [percentage], poolDst)).to.be.revertedWith(
            'not enabled'
        );

        await expect(zunami.enablePool(poolDst))
            .to.emit(zunami, 'ChangedPoolEnabledStatus')
            .withArgs(strategies[poolDst].address, true);
        await expect((await zunami.poolInfo(poolDst)).enabled).to.be.true;

        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.eq(0);
        await expect(await strategies[0].managementFees()).to.be.eq(0);
        await expect(await strategies[1].managementFees()).to.be.eq(0);
        await expect(zunami.moveFundsBatch([poolSrc], [percentage], poolDst));
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.gt(0);

        await expect(await strategies[0].managementFees()).to.be.gt(0);
        await expect(await strategies[1].managementFees()).to.be.eq(0);
        await expect(zunami.claimAllManagementFee());
        await expect(await strategies[0].managementFees()).to.be.eq(0);
        await expect(await strategies[1].managementFees()).to.be.eq(0);
    });
});
