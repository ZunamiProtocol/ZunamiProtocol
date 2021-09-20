import { ethers, network } from 'hardhat';
import { waffle } from 'hardhat';
import { expect } from 'chai';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory, Signer } from 'ethers';
import { Contract } from '@ethersproject/contracts';
import erc20ABI from './abi/erc20.abi.json';

const SUPPLY = '100000000000000';
const mockProvider = waffle.provider;
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const usdtAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7';

describe('Zunami', function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;

    let Zunami: ContractFactory;
    let CurveAaveConvex: ContractFactory;
    let zunami: Contract;
    let strategy: Contract;
    let referenceBlock: number;
    let dai: Contract;
    let usdc: Contract;
    let usdt: Contract;

    const impersonateAccount: string =
        '0xD465bE4e63bD09392bAC51Fcf04AA13412B552D0';

    before(async function () {
        [owner, alice, bob, carol] = await ethers.getSigners();

        Zunami = await ethers.getContractFactory('Zunami');
        CurveAaveConvex = await ethers.getContractFactory('CurveAaveConvex');
        dai = new ethers.Contract(daiAddress, erc20ABI, owner);
        usdc = new ethers.Contract(usdcAddress, erc20ABI, owner);
        usdt = new ethers.Contract(usdtAddress, erc20ABI, owner);
    });

    beforeEach(async function () {
        zunami = await Zunami.deploy();
        await zunami.deployed();

        strategy = await CurveAaveConvex.deploy();
        await strategy.deployed();
        strategy.setZunami(zunami.address);
        zunami.updateStrategy(strategy.address);

        referenceBlock = await mockProvider.getBlockNumber();
    });

    it('should correctly init contracts', async () => {
        const token: string = await strategy.tokens(0);
        expect(token).to.equal('0x6B175474E89094C44Da98b954EedeAC495271d0F');
    });

    it('deposit assets and mint lp', async () => {
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [impersonateAccount],
        });

        const impersonateAccountSigner: Signer =
            ethers.provider.getSigner(impersonateAccount);

        owner.sendTransaction({
            to: impersonateAccount,
            value: ethers.utils.parseEther('100'),
        });

        await dai
            .connect(impersonateAccountSigner)
            .approve(zunami.address, 1000);
        await usdc
            .connect(impersonateAccountSigner)
            .approve(zunami.address, 1000);
        await usdt
            .connect(impersonateAccountSigner)
            .approve(zunami.address, 1000);

        await zunami.connect(impersonateAccountSigner).deposit([150, 150, 150]);

        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [impersonateAccount],
        });
    });

    it('withdraw all assets', async () => {
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [impersonateAccount],
        });

        // Withdraw code should be here

        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [impersonateAccount],
        });
    });
});
