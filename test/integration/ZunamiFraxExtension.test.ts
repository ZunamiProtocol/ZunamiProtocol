import { ethers, network } from 'hardhat';
import {BigNumber, Contract, Signer} from 'ethers';
import { expect } from 'chai';

import { abi as erc20ABI } from '../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import * as addrs from '../address.json';
import * as globalConfig from "../../config.json";

const configStakingConvex = {
    tokens: globalConfig.tokens,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster,
};
describe('Zunami Frax extension tests', () => {
    let admin: Signer;
    let alice: Signer;
    let feeCollector: Signer;
    let zunami: Contract;
    let zunamiFraxExtension: Contract;
    let frax: Contract;

    beforeEach(async () => {
        [admin, alice, feeCollector] = await ethers.getSigners();
        const ZunamiFactory = await ethers.getContractFactory('Zunami');
        zunami = await ZunamiFactory.deploy([
            addrs.stablecoins.dai,
            addrs.stablecoins.usdc,
            addrs.stablecoins.usdt,
        ]);
        await zunami.deployed();

        const StableConverterFactory = await ethers.getContractFactory('StableConverter');
        const stableConverter = await StableConverterFactory.deploy();
        await stableConverter.deployed();

        const StubElasticRigidVault = await ethers.getContractFactory('StubElasticRigidVault');
        const stubElasticRigidVault = await StubElasticRigidVault.deploy();
        await stubElasticRigidVault.deployed();

        const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManager');
        const rewardManager = await RewardManagerFactory.deploy(stableConverter.address, stubElasticRigidVault.address, feeCollector.getAddress());
        await rewardManager.deployed();

        // Init all strategies
        const factory = await ethers.getContractFactory("MIMCurveStakeDao");
        const strategy = await factory.deploy(configStakingConvex);
        await strategy.deployed();

        strategy.setZunami(zunami.address);

        strategy.setRewardManager(rewardManager.address);

        await zunami.addPool(strategy.address);

        // FRAX initialization
        frax = new ethers.Contract(addrs.stablecoins.frax, erc20ABI, admin);
        admin.sendTransaction({
            to: addrs.holders.fraxHolder,
            value: ethers.utils.parseEther('10'),
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [addrs.holders.fraxHolder],
        });
        const fraxAccountSigner: Signer = ethers.provider.getSigner(addrs.holders.fraxHolder);
        await frax
            .connect(fraxAccountSigner)
            .transfer(admin.getAddress(), ethers.utils.parseUnits('1000000', 'ether'));
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [addrs.holders.fraxHolder],
        });

        await frax.transfer(alice.getAddress(), ethers.utils.parseUnits('100000', 'ether'));

        const FraxUsdcStableConverterFactory = await ethers.getContractFactory('FraxUsdcStableConverter');
        const fraxUsdcStableConverter = await FraxUsdcStableConverterFactory.deploy();
        await fraxUsdcStableConverter.deployed();

        const ZunamiFraxExtensionFactory = await ethers.getContractFactory('ZunamiFraxExtension');
        zunamiFraxExtension = await ZunamiFraxExtensionFactory.deploy(zunami.address, fraxUsdcStableConverter.address);
        await zunamiFraxExtension.deployed();
    });

    it('should deposit assets in not optimized mode', async () => {
        const fraxBefore = await frax.balanceOf(alice.getAddress());

        const amount = '1000';
        const fraxAmount = ethers.utils.parseUnits(amount, 'ether');

        expect(await zunami.balanceOf(alice.getAddress())).to.eq(0);

        await frax.connect(alice).approve(zunamiFraxExtension.address, fraxAmount);
        await zunamiFraxExtension.connect(alice).deposit(fraxAmount, 0);

        const fraxAfter = await frax.balanceOf(alice.getAddress());
        expect(fraxAfter).to.lt(fraxBefore);

        let zlpAmount = BigNumber.from(await zunami.balanceOf(alice.getAddress()));
        expect(zlpAmount).to.gt(0);

        const fraxAmountPotential = await zunamiFraxExtension.calcWithdraw(zlpAmount);

        await zunami.connect(alice).approve(zunamiFraxExtension.address, zlpAmount);
        await zunamiFraxExtension.connect(alice).withdraw(zlpAmount, 0);

        zlpAmount = BigNumber.from(await zunami.balanceOf(alice.getAddress()));
        expect(zlpAmount).to.eq(0);
        expect(await frax.balanceOf(alice.getAddress())).to.gt(fraxAfter);
        expect((await frax.balanceOf(alice.getAddress())).sub(fraxAfter)).to.eq(fraxAmountPotential);
    });
});
