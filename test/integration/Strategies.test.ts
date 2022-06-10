import { ethers, network } from 'hardhat';
import { BigNumber, Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import * as addrs from '../address.json';
import * as config from '../../config.json';

function getMinAmount(): BigNumber[] {
    const amount = '100';
    const dai = ethers.utils.parseUnits(amount, 'ether');
    const usdc = ethers.utils.parseUnits(amount, 'mwei');
    const usdt = ethers.utils.parseUnits(amount, 'mwei');
    return [dai, usdc, usdt];
}

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Single strategy tests', () => {
    const strategyNames = ['USDNCurveConvex', 'LUSDCurveConvex', 'USTWormholeCurveConvex'];

    let admin: Signer;
    let alice: Signer;
    let bob: Signer;
    let zunami: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;
    let strategies = Array<Contract>();

    before(async () => {
        [admin, alice, bob] = await ethers.getSigners();

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
    });

    beforeEach(async () => {
        const ZunamiFactory = await ethers.getContractFactory('Zunami');
        zunami = await ZunamiFactory.deploy([
            addrs.stablecoins.dai,
            addrs.stablecoins.usdc,
            addrs.stablecoins.usdt,
        ]);
        await zunami.deployed();

        // Init all stratigies
        for (const strategyName of strategyNames) {
            const factory = await ethers.getContractFactory(strategyName);
            const strategy = await factory.deploy(config);
            await strategy.deployed();

            strategy.setZunami(zunami.address);
            strategies.push(strategy);
        }

        for (const user of [admin, alice, bob]) {
            await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
            await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
            await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));

            await dai.transfer(user.getAddress(), ethers.utils.parseUnits('1000', 'ether'));
            await usdc.transfer(user.getAddress(), ethers.utils.parseUnits('1000', 'mwei'));
            await usdt.transfer(user.getAddress(), ethers.utils.parseUnits('1000', 'mwei'));
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
                        .delegateWithdrawal(zlpAmount, [0, 0, 0], WithdrawalType.Base, 0)
                )
                    .to.emit(zunami, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0]);
            }

            await expect(
                zunami.completeWithdrawalsBase([alice.getAddress(), bob.getAddress()], [0, 0, 0])
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
                        .delegateWithdrawal(zlpAmount, [0, 0, 0], WithdrawalType.OneCoin, 0)
                )
                    .to.emit(zunami, 'CreatedPendingWithdrawal')
                    .withArgs(await user.getAddress(), zlpAmount, [0, 0, 0]);
            }

            await expect(
                zunami.completeWithdrawalsOneCoin([alice.getAddress(), bob.getAddress()], [0, 0, 0])
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
                    zunami.connect(user).withdraw(zlpAmount, [0, 0, 0], WithdrawalType.Base, 0)
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
                    zunami.connect(user).withdraw(zlpAmount, [0, 0, 0], WithdrawalType.OneCoin, 0)
                ).to.emit(zunami, 'Withdrawn');

                zlpAmount = BigNumber.from(await zunami.balanceOf(user.getAddress()));
                expect(zlpAmount).to.eq(0);
            }
        }
    });

    it('should moveFunds only to not outdated pool', async () => {
        const poolSrc = 0;
        const poolDst = 1;
        const veryBigNumber = 1_000_000_000;
        const percentage = 10_000;

        for (let poolId = 0; poolId < 2; poolId++) {
            await zunami.addPool(strategies[poolId].address);
        }

        await zunami.setDefaultDepositPid(poolSrc);
        await zunami.setDefaultWithdrawPid(poolSrc);

        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect(zunami.connect(alice).deposit(getMinAmount())).to.emit(zunami, 'Deposited');
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);

        await expect(zunami.togglePoolStatus(veryBigNumber)).to.be.revertedWith(
            'Zunami: incorrect an index of the pool'
        );

        await expect(zunami.togglePoolStatus(poolSrc)).to.be.revertedWith(
            'Zunami: current pool is set as deposit/withdraw default pool'
        );

        await expect(zunami.togglePoolStatus(poolDst))
            .to.emit(zunami, 'ToggledDisabledPoolStatus')
            .withArgs(strategies[poolDst].address, true);

        await expect((await zunami.poolInfo(poolDst)).disabled).to.be.true;

        await expect(zunami.moveFundsBatch([poolSrc], [percentage], poolDst)).to.be.revertedWith(
            'Zunami: Operations with a disabled pool'
        );

        await expect(zunami.togglePoolStatus(poolDst))
            .to.emit(zunami, 'ToggledDisabledPoolStatus')
            .withArgs(strategies[poolDst].address, false);
        await expect((await zunami.poolInfo(poolDst)).disabled).to.be.false;

        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.gt(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.eq(0);
        await expect(zunami.moveFundsBatch([poolSrc], [percentage], poolDst));
        await expect((await zunami.poolInfo(poolSrc)).lpShares).to.be.eq(0);
        await expect((await zunami.poolInfo(poolDst)).lpShares).to.be.gt(0);
    });
});
