import { ethers, network } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import * as addrs from '../address.json';

enum WithdrawalType {
    Base,
    OneCoin,
}

describe('Zunami core functionality tests', () => {
    const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    let admin: Signer;
    let alice: Signer;
    let zunami: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    beforeEach(async () => {
        [admin, alice] = await ethers.getSigners();
        const ZunamiFactory = await ethers.getContractFactory('Zunami');
        zunami = await ZunamiFactory.deploy([
            addrs.stablecoins.dai,
            addrs.stablecoins.usdc,
            addrs.stablecoins.usdt,
        ]);
        await zunami.deployed();

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
            .transfer(admin.getAddress(), ethers.utils.parseUnits('1000000', 'mwei'));
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

        for (const user of [admin, alice]) {
            await usdc.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
            await usdt.connect(user).approve(zunami.address, parseUnits('1000000', 'mwei'));
            await dai.connect(user).approve(zunami.address, parseUnits('1000000', 'ether'));
        }
    });

    it('should add and revoke admin role successfully', async () => {
        const aliceAddr = await alice.getAddress();
        await expect(zunami.connect(alice).grantRole(DEFAULT_ADMIN_ROLE, aliceAddr)).to.be.reverted;
        expect(await zunami.hasRole(DEFAULT_ADMIN_ROLE, aliceAddr)).to.false;

        await zunami.grantRole(DEFAULT_ADMIN_ROLE, aliceAddr);
        expect(await zunami.hasRole(DEFAULT_ADMIN_ROLE, aliceAddr)).to.true;

        await zunami.revokeRole(DEFAULT_ADMIN_ROLE, aliceAddr);
        expect(await zunami.hasRole(DEFAULT_ADMIN_ROLE, aliceAddr)).to.false;
    });

    it('should add and revoke operator role successfully', async () => {
        const aliceAddr = await alice.getAddress();
        const operatorRole: string = await zunami.OPERATOR_ROLE();
        expect(await zunami.hasRole(operatorRole, aliceAddr)).to.false;

        await zunami.grantRole(operatorRole, aliceAddr);
        expect(await zunami.hasRole(operatorRole, aliceAddr)).to.true;

        await zunami.revokeRole(operatorRole, aliceAddr);
        expect(await zunami.hasRole(operatorRole, aliceAddr)).to.false;

        await zunami.updateOperator(aliceAddr);
        expect(await zunami.hasRole(operatorRole, aliceAddr)).to.true;
    });

    it('should handle paused/unpaused mode properly', async () => {
        const adminAddr = await admin.getAddress();
        await expect(zunami.pause()).to.emit(zunami, 'Paused').withArgs(adminAddr);

        //All functions which would be crashed
        await expect(zunami.delegateDeposit([1, 1, 1])).to.be.revertedWith('Pausable: paused');
        await expect(zunami.delegateWithdrawal(1, [1, 1, 1], WithdrawalType.Base, 0)).to.be.revertedWith(
            'Pausable: paused'
        );
        await expect(zunami.deposit([1, 1, 1])).to.be.revertedWith('Pausable: paused');
        await expect(zunami.withdraw(1, [1, 1, 1], 1, 1)).to.be.revertedWith('Pausable: paused');

        await expect(zunami.unpause()).to.emit(zunami, 'Unpaused').withArgs(adminAddr);
    });

    it('should add new withdrawal types', async () => {
        //Check access permisions
        await expect(zunami.connect(alice).setAvailableWithdrawalTypes(3)).to.be.reverted;

        await expect(zunami.setAvailableWithdrawalTypes(100)).to.be.revertedWith(
            'Zunami: wrong available withdrawal types'
        );

        const typesBefore = await zunami.availableWithdrawalTypes();
        await zunami.setAvailableWithdrawalTypes(2);
        const typesAfter = await zunami.availableWithdrawalTypes();
        expect(typesBefore).to.not.eq(typesAfter);
    });

    it('should set and calculate management fee properly', async () => {
        //Check access permisions
        await expect(zunami.connect(alice).setManagementFee(20)).to.be.reverted;

        const twoPercentValue = 20; //2%
        const feeBefore = await zunami.managementFee();
        expect(await zunami.setManagementFee(twoPercentValue));
        const feeAfter = await zunami.managementFee();
        expect(feeBefore).to.not.eq(feeAfter);

        const calculatedFee = await zunami.calcManagementFee(1000);
        expect(parseFloat(calculatedFee)).equal(twoPercentValue);
    });

    it('should add new pool into the protocol', async () => {
        //Check access permisions
        await expect(zunami.connect(alice).addPool(0)).to.be.reverted;

        const poolCountBefore = await zunami.poolCount();
        const fakeStrategyAddr = '0x0000000000000000000000000000000000000001';

        await expect(zunami.addPool(ZERO_ADDRESS)).to.be.revertedWith('Zunami: zero strategy addr');
        await expect(zunami.addPool(fakeStrategyAddr)).to.emit(zunami, 'AddedPool');

        const poolCountAfter = await zunami.poolCount();
        expect(poolCountBefore).to.not.eq(poolCountAfter);
    });

    it('should set default pools for deposit and withdrawal', async () => {
        const defaultDepositPoolBefore = await zunami.defaultDepositPid();
        const defaultWithdrawalPoolBefore = await zunami.defaultWithdrawPid();
        const fakeStrategyAddr1 = '0x0000000000000000000000000000000000000001';
        const fakeStrategyAddr2 = '0x0000000000000000000000000000000000000002';
        const fakeStrategyAddr3 = '0x0000000000000000000000000000000000000003';
        const illegalPoolNumber = 100;
        const poolNumber1 = 1;
        const poolNumber2 = 2;

        await expect(zunami.addPool(fakeStrategyAddr1)).to.emit(zunami, 'AddedPool');
        await expect(zunami.addPool(fakeStrategyAddr2)).to.emit(zunami, 'AddedPool');
        await expect(zunami.addPool(fakeStrategyAddr3)).to.emit(zunami, 'AddedPool');

        await expect(zunami.setDefaultDepositPid(illegalPoolNumber)).to.be.revertedWith(
            'Zunami: incorrect default deposit pool id'
        );
        await expect(zunami.setDefaultDepositPid(poolNumber1))
            .to.emit(zunami, 'SetDefaultDepositPid')
            .withArgs(poolNumber1);
        const defaultDepositPoolAfter = await zunami.defaultDepositPid();
        expect(defaultDepositPoolBefore).to.be.not.eq(defaultDepositPoolAfter);

        await expect(zunami.setDefaultWithdrawPid(illegalPoolNumber)).to.be.revertedWith(
            'Zunami: incorrect default withdraw pool id'
        );
        await expect(zunami.setDefaultWithdrawPid(poolNumber2))
            .to.emit(zunami, 'SetDefaultWithdrawPid')
            .withArgs(poolNumber2);
        const defaultWithdrawalPoolAfter = await zunami.defaultWithdrawPid();
        expect(defaultWithdrawalPoolBefore).to.not.eq(defaultWithdrawalPoolAfter);
    });

    it('should lock deposit and withdrawal operations by the lock flag', async () => {
        expect(await zunami.launched()).to.false;

        await expect(zunami.completeDeposits([ZERO_ADDRESS])).to.be.revertedWith(
            'Zunami: pool not existed!'
        );

        await zunami.launch();
        expect(await zunami.launched()).to.true;

        const fakeStrategyAddr = '0x0000000000000000000000000000000000000001';

        await expect(zunami.addPool(fakeStrategyAddr)).to.emit(zunami, 'AddedPool');
        await expect(zunami.completeDeposits([ZERO_ADDRESS])).to.be.revertedWith(
            'Zunami: default deposit pool not started yet!'
        );
        await expect(zunami.completeWithdrawals([ZERO_ADDRESS])).to.be.revertedWith(
            'Zunami: default deposit pool not started yet!'
        );
        await expect(zunami.completeWithdrawals([ZERO_ADDRESS])).to.be.revertedWith(
            'Zunami: default deposit pool not started yet!'
        );
        await expect(zunami.deposit([0, 0, 0])).to.be.revertedWith(
            'Zunami: default deposit pool not started yet!'
        );
        await expect(zunami.withdraw(0, [0, 0, 0], 0, 0)).to.be.revertedWith(
            'Zunami: default deposit pool not started yet!'
        );
    });

    it('should withdraw all stuck tokens', async () => {
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

        const usdtBalance = await usdt.balanceOf(admin.getAddress());
        await usdt.connect(admin).transfer(zunami.address, usdtBalance / 2);
        expect(await usdt.balanceOf(admin.getAddress())).to.eq(usdtBalance / 2);
        expect(await usdt.balanceOf(zunami.address)).to.eq(usdtBalance / 2);

        await zunami.withdrawStuckToken(usdt.address);
        expect(await usdt.balanceOf(admin.getAddress())).to.eq(usdtBalance);
        expect(await usdt.balanceOf(zunami.address)).to.be.eq(0);
    });

    it('should get pending deposits properly', async () => {
        await dai.transfer(alice.getAddress(), 50);
        await usdc.transfer(alice.getAddress(), 100);
        await usdt.transfer(alice.getAddress(), 150);

        let pendingDai = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 0)
        );
        let pendingUsdc = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 1)
        );
        let pendingUsdt = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 2)
        );

        expect(pendingDai + pendingUsdc + pendingUsdt).to.eq(0);

        let userAssets: number[] = await zunami.connect(alice).pendingDeposits(alice.getAddress());

        let balanceBefore: number = userAssets.reduce((prev, curr) => +prev + +curr);
        expect(balanceBefore).to.eq(0);

        await expect(zunami.connect(alice).delegateDeposit([50, 100, 150]))
            .to.emit(zunami, 'CreatedPendingDeposit')
            .withArgs(await alice.getAddress(), [50, 100, 150]);

        pendingDai = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 0)
        );
        pendingUsdc = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 1)
        );
        pendingUsdt = parseInt(
            await zunami.connect(alice).pendingDepositsToken(alice.getAddress(), 2)
        );

        userAssets = await zunami.connect(alice).pendingDeposits(alice.getAddress());

        balanceBefore = userAssets.reduce((prev, curr) => +prev + +curr);
        expect(balanceBefore).to.eq(300);

        expect(pendingDai).to.eq(50);
        expect(pendingUsdc).to.eq(100);
        expect(pendingUsdt).to.eq(150);
    });

    it('should get pending withdrawals properly', async () => {
        let userAssets = await zunami.connect(alice).pendingWithdrawals(alice.getAddress());
        let lpShares = userAssets[0];
        let coins: number = userAssets[1].reduce((prev: number, curr: number) => +prev + +curr);
        expect(lpShares).to.eq(0);
        expect(coins).to.eq(0);

        await expect(zunami.connect(alice).delegateWithdrawal(55555, [50, 100, 150], WithdrawalType.Base, 0))
            .to.emit(zunami, 'CreatedPendingWithdrawal')
            .withArgs(await alice.getAddress(), 55555, [50, 100, 150]);

        userAssets = await zunami.connect(alice).pendingWithdrawals(alice.getAddress());
        lpShares = userAssets[0];
        coins = userAssets[1].reduce((prev: number, curr: number) => +prev + +curr);
        expect(lpShares).to.eq(55555);
        expect(coins).to.eq(300);
    });
});
