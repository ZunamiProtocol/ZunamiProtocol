import { ethers } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import chai from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';
const { expectRevert } = require('@openzeppelin/test-helpers');

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

describe('ClaimingStrat', () => {
    let admin: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let claimingStrat: Contract;
    let usdt: Contract;
    let usdc: Contract;
    let dai: Contract;

    beforeEach(async () => {
        [admin, alice, bob, carol, rosa] = await ethers.getSigners();

        usdt = await stubToken(6, admin);
        usdc = await stubToken(6, admin);
        dai = await stubToken(18, admin);

        const ClaimingStrat = await ethers.getContractFactory('ClaimingStrat', admin);
        claimingStrat = await ClaimingStrat.deploy([dai.address, usdc.address, usdt.address]);
        await claimingStrat.deployed();
        expect(claimingStrat.address).to.properAddress;
    });

    it('should create claims', async () => {
        const claimers = [alice, bob, carol, rosa];
        const claimerAddresses = await Promise.all(claimers.map((c)=> c.getAddress()));
        const balances = [10, 20, 69, 1];

        const result = await claimingStrat.createClaims(claimerAddresses, balances);

        for (let i = 0; i < claimers.length; i++) {
            const claimer =  claimerAddresses[i];
            const balance =  balances[i];

            await expect(result)
              .to.emit(claimingStrat, 'ClaimCreated')
              .withArgs(claimer, balance);

            const claim = await claimingStrat.claims(claimer);
            expect(claim.claimer).to.eq(claimer);
            expect(claim.balance).to.eq(balance);
            expect(claim.batch).to.eq(0); //no batch
            expect(claim.withdrew).to.eq(false);
        }

        expect(await claimingStrat.totalBalance()).to.eq(balances.reduce((prev, cur) => prev + cur, 0));
    });

    it('should request and withdraw claims', async () => {
        const claimers = [alice, bob, carol, rosa];
        const claimerAddresses = await Promise.all(claimers.map((c)=> c.getAddress()));
        const balances = [10, 20, 69, 1];
        const tokenAmounts = [3000000, 100, 200];

        const batch = await claimingStrat.currentBatch();
        await claimingStrat.createClaims(claimerAddresses, balances);

        for (let i = 0; i < claimers.length; i++) {
            const claimer = claimers[i];
            const claimerAddr = claimerAddresses[i];

            await claimingStrat.connect(claimer).requestClaim();
            expect(await claimingStrat.batchesTotalBalance(batch)).to.eq(balances.reduce(
              (prev, cur, index) => index <= i ? prev + cur : prev, 0)
            );
            const claim = await claimingStrat.claims(claimerAddr);
            expect(claim.batch).to.eq(batch);

            // not second request
            await expectRevert(
              claimingStrat.connect(claimer).requestClaim(),
              'Requested claim'
            );

            // not withdraw before finishing batch
            await expectRevert(
              claimingStrat.connect(claimer).withdrawClaim(),
              'Not finished batch'
            );
        }

        expect(await claimingStrat.batchesFinished(batch)).to.be.false;
        expect(await claimingStrat.batchesTotalBalance(batch))
          .to.eq(balances.reduce((prev, cur) => prev + cur, 0));

        await claimingStrat.startNewBatch();

        await dai.mint(claimingStrat.address, tokenAmounts[0]);
        await usdc.mint(claimingStrat.address, tokenAmounts[1]);
        await usdt.mint(claimingStrat.address, tokenAmounts[2]);
        await claimingStrat.finishPreviousBatch(tokenAmounts);

        const batchTotalBalance = await claimingStrat.batchesTotalBalance(batch);
        for (let i = 0; i < claimers.length; i++) {
            const claimer =  claimers[i];
            const claimerAddr = claimerAddresses[i];

            await claimingStrat.connect(claimer).withdrawClaim();
            expect( await dai.balanceOf(claimerAddr)).to.eq(tokenAmounts[0] * balances[i] / batchTotalBalance);
            expect( await usdc.balanceOf(claimerAddr)).to.eq(tokenAmounts[1] * balances[i] / batchTotalBalance);
            expect( await usdt.balanceOf(claimerAddr)).to.eq(tokenAmounts[2] * balances[i] / batchTotalBalance);
        }

        for (let i = 0; i < claimers.length; i++) {
            const claimer =  claimers[i];

            // not request when it was withdrew
            await expectRevert(
              claimingStrat.connect(claimer).requestClaim(),
              'Requested claim'
            );

            // not withdraw twice
            await expectRevert(
              claimingStrat.connect(claimer).withdrawClaim(),
              'Claim was withdrew'
            );
        }
    });


    it('should start new batch and finish previous batch', async () => {
        const previousBatch = 1;
        const currentBatch = 2;
        const nextBatch = 3;
        expect(await claimingStrat.currentBatch()).to.eq(previousBatch);
        expect(await claimingStrat.batchesFinished(previousBatch)).to.be.false;
        await claimingStrat.startNewBatch();
        expect(await claimingStrat.currentBatch()).to.eq(currentBatch);
        expect(await claimingStrat.batchesFinished(currentBatch)).to.be.false;

        await expectRevert(
          claimingStrat.startNewBatch(),
          'Not finished previous batch'
        );

        await claimingStrat.finishPreviousBatch([100, 200, 3000000]);
        expect(await claimingStrat.batchesFinished(previousBatch)).to.be.true;
        expect(await claimingStrat.batchesFinished(currentBatch)).to.be.false;
        expect(await claimingStrat.batchesAmounts(previousBatch,0)).to.be.eq(100);
        expect(await claimingStrat.batchesAmounts(previousBatch,1)).to.be.eq(200);
        expect(await claimingStrat.batchesAmounts(previousBatch,2)).to.be.eq(3000000);

        await claimingStrat.startNewBatch();
        expect(await claimingStrat.currentBatch()).to.eq(nextBatch);
    });
});
