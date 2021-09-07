import { ethers } from 'hardhat';
import { waffle } from 'hardhat';
import { expect } from 'chai';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ContractFactory } from 'ethers';
import { Contract } from '@ethersproject/contracts';

const SUPPLY = '100000000000000';
const ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
const provider = waffle.provider;

describe('Zunami', function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;

    let LPToken: ContractFactory;
    let Zunami: ContractFactory;
    let CurveAaveConvex: ContractFactory;
    let lp: Contract;
    let zunami: Contract;
    let strategy: Contract;
    let referenceBlock: number;

    before(async function () {
        [owner, alice, bob, carol] = await ethers.getSigners();

        LPToken = await ethers.getContractFactory('LPToken');
        Zunami = await ethers.getContractFactory('Zunami');
        CurveAaveConvex = await ethers.getContractFactory('CurveAaveConvex');
    });

    beforeEach(async function () {
        lp = await LPToken.deploy('LP', 'LP');
        await lp.deployed();
        await lp.mint(owner.address, SUPPLY);

        zunami = await Zunami.deploy(lp.address);
        await zunami.deployed();

        await lp.grantRole(ADMIN_ROLE, zunami.address);

        strategy = await CurveAaveConvex.deploy();
        await strategy.deployed();

        referenceBlock = await provider.getBlockNumber();
    });

    it('should correctly init contracts', async () => {
        expect(await lp.balanceOf(owner.address)).to.be.equal(SUPPLY);

        const token: string = await strategy.tokens(0);
        expect(token).to.equal('0x6B175474E89094C44Da98b954EedeAC495271d0F');
    });

    it('deposit assets and get lp', async () => {
        zunami.deposit;
    });
});
