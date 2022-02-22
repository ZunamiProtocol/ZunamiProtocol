import { ethers, waffle, artifacts } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import { MockContract } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import BigNumber from 'bignumber.js';

const { deployMockContract, provider } = waffle;
const [wallet, otherWallet] = provider.getWallets();

const { expectRevert, time } = require('@openzeppelin/test-helpers');

import chai from 'chai';

const { expect } = chai;

import { MIN_LOCK_TIME } from './../constants/TestConstants';

export const bn = (num: string | number) => new BigNumber(num);
export const decify = (value: any, decimals: any) =>
    bn(value).times(bn(10).pow(decimals)).integerValue();
export const undecify = (value: any, decimals: any) =>
    bn(value.toString()).dividedBy(bn(10).pow(decimals));
export const tokenify = (value: any) => decify(value, 18);

async function stubToken(decimals: number, owner: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', owner);
    const token = await StubToken.deploy('StubToken', 'StubToken', decimals);
    await token.deployed();
    return token;
}

const mockContract = async (name: string) =>
    deployMockContract(wallet, (await artifacts.readArtifact(name)).abi);


describe('CurveConvexStrat2', () => {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let strategy: Contract;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    let pool: MockContract;
    let poolLP: Contract;
    let rewards: MockContract;
    let poolPID: number;
    let token: Contract;
    let extraRewards: MockContract;
    let extraToken: Contract;

    async function mintAndApproveTokens(user: SignerWithAddress, tokenAmounts: number[]) {
        const tokenBalances = [
            tokenify(tokenAmounts[0]).toFixed(),
            decify(tokenAmounts[1], 6).toFixed(),
            decify(tokenAmounts[2], 6).toFixed(),
        ];

        await dai.mint(user.address, tokenBalances[0]);
        await dai.connect(user).approve(strategy.address, tokenBalances[0]);

        await usdc.mint(user.address, tokenBalances[1]);
        await usdc.connect(user).approve(strategy.address, tokenBalances[1]);

        await usdt.mint(user.address, tokenBalances[2]);
        await usdt.connect(user).approve(strategy.address, tokenBalances[2]);

        return tokenBalances;
    }

    beforeEach(async () => {
        [owner, alice, bob, carol, rosa] = await ethers.getSigners();

        dai = await stubToken(18, owner);
        usdc = await stubToken(6, owner);
        usdt = await stubToken(6, owner);

        pool = await mockContract("ICurvePool2");
        poolLP = await stubToken(18, owner);
        rewards = await mockContract("IConvexRewards");
        poolPID = 2;
        token = await stubToken(18, owner);
        extraRewards = await mockContract("IConvexRewards");
        extraToken = await stubToken(18, owner);

        const Strat = await ethers.getContractFactory('CurveConvexStrat2', owner);
        strategy = await Strat.deploy(
            pool.address,
            poolLP.address,
            rewards.address,
            poolPID,
            token.address,
            extraRewards.address,
            extraToken.address,
        );
        await strategy.deployed(

        );
        expect(strategy.address).to.properAddress;
    });

    it('should created rightly', async () => {
        await expect(await strategy.zunami()).to.be.equal('0x0000000000000000000000000000000000000000');
        await expect(await strategy.cvxPoolPID()).to.be.equal(poolPID);
        await expect(await strategy.poolLP()).to.be.equal(poolLP);
        await expect(await strategy.cvxRewards()).to.be.equal(rewards);
        await expect(await strategy.feeDistributor()).to.be.equal(owner.address);

        await expect(await strategy.token()).to.be.equal(token.address);
        await expect(await strategy.extraToken()).to.be.equal(extraToken.address);
        await expect(await strategy.extraRewards()).to.be.equal(extraRewards.address);

        await expect(await strategy.pool()).to.be.equal(pool.address);
        await expect(await strategy.pool3()).to.properAddress;
        await expect(await strategy.pool3LP()).to.properAddress;
    });
});
