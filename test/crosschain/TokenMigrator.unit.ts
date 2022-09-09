import { ethers } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import chai from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';

const { expect } = chai;

export const bn = (num: string | number) => new BigNumber(num);
export const decify = (value: any, decimals: any) =>
    bn(value).times(bn(10).pow(decimals)).integerValue();
export const undecify = (value: any, decimals: any) =>
    bn(value.toString()).dividedBy(bn(10).pow(decimals));
export const tokenify = (value: any) => decify(value, 18);

async function stubToken(decimals: number, admin: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', admin);
    const token = await StubToken.deploy('StubToken', 'StubToken', decimals);
    await token.deployed();
    return token;
}

describe('TokenMigrator', () => {
    let admin: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let migrator: Contract;
    let tokenFrom: Contract;
    let tokenTo: Contract;

    beforeEach(async () => {
        [admin, alice, bob, carol, rosa] = await ethers.getSigners();

        tokenFrom = await stubToken(18, admin);
        tokenTo = await stubToken(18, admin);

        const TokenMigrator = await ethers.getContractFactory('TokenMigrator', admin);
        migrator = await TokenMigrator.deploy(tokenFrom.address, tokenTo.address);
        await migrator.deployed();
        expect(migrator.address).to.properAddress;
    });

    it('should be configured', async () => {
        await expect(await migrator.tokenFrom()).to.be.equal(tokenFrom.address);
        await expect(await migrator.tokenTo()).to.be.equal(tokenTo.address);
    });

    it('should migrate tokens', async () => {
        const balance = tokenify(100).toFixed();
        await tokenFrom.mint(alice.address, balance);
        await tokenTo.mint(migrator.address, balance);

        await expect(await tokenFrom.balanceOf(alice.address)).to.be.equal(balance);
        await expect(await tokenTo.balanceOf(alice.address)).to.be.equal(0);
        await expect(await tokenTo.balanceOf(migrator.address)).to.be.equal(balance);

        await tokenFrom.connect(alice).approve(migrator.address, balance);
        await migrator.connect(alice).migrate();
        await expect(await tokenFrom.balanceOf(alice.address)).to.be.equal(0);
        await expect(await tokenTo.balanceOf(alice.address)).to.be.equal(balance);
        await expect(await tokenTo.balanceOf(migrator.address)).to.be.equal(0);
    });
});
