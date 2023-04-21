import {ethers} from 'hardhat';
import {Contract} from '@ethersproject/contracts';
import {expect} from 'chai';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';

export const bn = (num: string | number) => new BigNumber(num)
export const withDecimals = (value: number | string) =>
    bn(value).times(bn(10).pow(18)).integerValue();

async function stubPool(decimals: number, admin: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', admin);
    const token = await StubToken.deploy('StubToken', 'StubToken', decimals);
    await token.deployed();
    return token;
}

describe('SnapshotHelper', () => {
    let admin: SignerWithAddress;
    let poolAdmin: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    let pool1: Contract;
    let pool2: Contract;
    let pool3: Contract;
    let snapshotHelper: Contract;

    beforeEach(async () => {
        [admin, poolAdmin, alice, bob] = await ethers.getSigners();

        pool1 = await stubPool(18, poolAdmin);
        pool2 = await stubPool(18, poolAdmin);
        pool3 = await stubPool(18, poolAdmin);

        const snapshotHelperFactory = await ethers.getContractFactory('SnapshotHelper');
        snapshotHelper = await snapshotHelperFactory.deploy(
            [pool1.address, pool2.address, pool3.address],
        );
        await snapshotHelper.deployed();
        expect(snapshotHelper.address).to.properAddress;
        expect(await snapshotHelper.poolGaugeCount()).to.equal(3);
    });

    it('aggregated balance should return 0 after deployment for empty balances', async () => {
        const aggregatedBalance = await snapshotHelper.aggregatedBalanceOf(alice.address);

        expect(aggregatedBalance).to.equal(0);
    })

    it('aggregated balance should return more than 0 after minting', async () => {
        await pool1.connect(poolAdmin).mint(alice.address, withDecimals(100).toFixed());
        await pool2.connect(poolAdmin).mint(alice.address, withDecimals(123).toFixed());
        await pool3.connect(poolAdmin).mint(alice.address, withDecimals(101).toFixed());

        const expectedResult = withDecimals(324).toFixed();
        const aggregatedBalance = await snapshotHelper.aggregatedBalanceOf(alice.address);

        expect(aggregatedBalance).to.equal(expectedResult);
    });

    it('add pool and get aggregated balance', async () => {
        const pool4 = await stubPool(18, poolAdmin);
        await expect(snapshotHelper.addPoolGauge(pool4.address))
            .to.emit(snapshotHelper, 'AddedPoolGauge')
            .withArgs(3, pool4.address);

        await pool1.connect(poolAdmin).mint(alice.address, withDecimals(100).toFixed());
        await pool2.connect(poolAdmin).mint(alice.address, withDecimals(123).toFixed());
        await pool3.connect(poolAdmin).mint(alice.address, withDecimals(101).toFixed());
        await pool4.connect(poolAdmin).mint(alice.address, withDecimals(111).toFixed());

        const expectedResult = withDecimals(435).toFixed();
        const aggregatedBalance = await snapshotHelper.aggregatedBalanceOf(alice.address);

        expect(aggregatedBalance).to.equal(expectedResult);
    });

    it('disable pool and get aggregated balance', async () => {
        await expect(snapshotHelper.togglePoolGaugeStatus(0))
            .to.emit(snapshotHelper, 'ToggledEnabledPoolGaugeStatus')
            .withArgs(pool1.address, false);

        await pool1.connect(poolAdmin).mint(alice.address, withDecimals(100).toFixed());
        await pool2.connect(poolAdmin).mint(alice.address, withDecimals(123).toFixed());
        await pool3.connect(poolAdmin).mint(alice.address, withDecimals(101).toFixed());

        const expectedResult = withDecimals(224).toFixed();
        const aggregatedBalance = await snapshotHelper.aggregatedBalanceOf(alice.address);

        expect(aggregatedBalance).to.equal(expectedResult);
    });
});
