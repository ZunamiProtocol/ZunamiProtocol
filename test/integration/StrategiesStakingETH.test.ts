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
    const eth = ethers.utils.parseUnits(amount, 'ether');
    const wEth = ethers.utils.parseUnits(amount, 'ether');
    const frxEth = ethers.utils.parseUnits(amount, 'ether');
    return [eth, wEth, frxEth, zero, zero];
}

async function toggleUnlockStakes() {
    const stakingOwner = '0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27';
    const stakingAddress = '0xa537d64881b84faffb9Ae43c951EEbF368b71cdA';
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

describe('Single ETH FraxStaking strategy tests', () => {
    const strategyNames = ['frxEthStakingFraxCurveConvex'];
    enum WithdrawalType {
        Base,
        OneCoin,
    }

    const configConvexETH = {};

    const configStakingConvexETH = {
        tokens: globalConfig.tokensETH,
        rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
        booster: globalConfig.stakingBooster,
    };

    const configStakeDaoETH = {};

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let feeCollector: Signer;
    let zunami: Contract;
    let wEth: Contract;
    let frxEth: Contract;
    let strategies = Array<Contract>();
    let rewardManager: Contract;

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
            'SellingCurveRewardManagerNative'
        );
        rewardManager = await RewardManagerFactory.deploy(feeCollector.getAddress());
        await rewardManager.deployed();
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
                : configConvexETH;
            const strategy = await factory.deploy(config);
            await strategy.deployed();

            strategy.setZunami(zunami.address);

            strategy.setRewardManager(rewardManager.address);

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

                await expect(
                    zunami.connect(user).delegateDeposit(minAmounts, { value: minAmounts[0] })
                )
                    .to.emit(zunami, 'CreatedPendingDeposit')
                    .withArgs(await user.getAddress(), getMinAmount());

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

                await expect(
                    zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })
                ).to.emit(zunami, 'Deposited');

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
                await expect(
                    zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })
                ).to.emit(zunami, 'Deposited');

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

            await increaseChainTime(60 * 60);

            await toggleUnlockStakes();

            await expect(
                zunami.completeWithdrawalsBase(
                    [alice.getAddress(), bob.getAddress()],
                    [0, 0, 0, 0, 0]
                )
            ).to.emit(zunami, 'Withdrawn');

            await toggleUnlockStakes();
        }
    });

    it('should withdraw assets in optimized one coin mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                await expect(
                    zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })
                ).to.emit(zunami, 'Deposited');

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

            await increaseChainTime(60 * 60);

            await toggleUnlockStakes();

            await expect(
                zunami.completeWithdrawalsOneCoin(
                    [alice.getAddress(), bob.getAddress()],
                    [0, 0, 0, 0, 0]
                )
            ).to.emit(zunami, 'Withdrawn');

            await toggleUnlockStakes();
        }
    });

    it('should withdraw assets in not optimized mode', async () => {
        for (let poolId = 0; poolId < strategies.length; poolId++) {
            await zunami.addPool(strategies[poolId].address);
            await zunami.setDefaultDepositPid(poolId);
            await zunami.setDefaultWithdrawPid(poolId);

            const minAmounts = getMinAmount();
            for (const user of [alice, bob]) {
                await expect(
                    zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })
                ).to.emit(zunami, 'Deposited');

                let zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await increaseChainTime(60 * 60);

                await toggleUnlockStakes();

                await expect(
                    zunami
                        .connect(user)
                        .withdraw(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.Base, 0)
                ).to.emit(zunami, 'Withdrawn');
                zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);

                await toggleUnlockStakes();
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
                await expect(
                    zunami.connect(user).deposit(minAmounts, { value: minAmounts[0] })
                ).to.emit(zunami, 'Deposited');

                let zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.gt(0);

                await increaseChainTime(60 * 60);

                await toggleUnlockStakes();

                await expect(
                    zunami
                        .connect(user)
                        .withdraw(zlpAmount, [0, 0, 0, 0, 0], WithdrawalType.OneCoin, 0)
                ).to.emit(zunami, 'Withdrawn');

                zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);

                await toggleUnlockStakes();
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

            await expect(
                zunami.connect(alice).deposit(minAmounts, { value: minAmounts[0] })
            ).to.emit(zunami, 'Deposited');
        }
        let tokens;
        let balance;

        await increaseChainTime(3600 * 24 * 1);
        await zunami.autoCompoundAll();

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
