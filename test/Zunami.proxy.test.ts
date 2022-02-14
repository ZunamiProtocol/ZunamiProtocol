import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {ContractFactory, Signer} from 'ethers';

const { expectRevert } = require('@openzeppelin/test-helpers');

import { Contract } from '@ethersproject/contracts';

describe('Zunami', function () {
    let zunami: Contract;
    let owner: Signer;
    let hacker: Signer;

    before(async function () {
        const signers = await ethers.getSigners();
        owner = signers[0];
        hacker = signers[1];

        let Zunami: ContractFactory = await ethers.getContractFactory('ZunamiUpgradeable', { signer: owner });
        zunami = await upgrades.deployProxy(Zunami, [], {kind: 'uups'});
        await zunami.deployed();
    });

    it('should be updatable', async () => {
        try{
            await zunami.version()
        } catch(e: any) {
            expect(e.message).to.equals('zunami.version is not a function');
        }

        const ZunamiV2 = await ethers.getContractFactory("TestZunamiUpgradeableV2", { signer: owner });
        const zunamiV2 = await upgrades.upgradeProxy(zunami.address, ZunamiV2);

        expect(await zunamiV2.owner()).to.equals(await zunami.owner());
        console.log(await zunamiV2.version());
        expect((await zunamiV2.version()).toString()).to.equals("2");
    });

    it('should not be updatable by others except the owner', async () => {
        const ZunamiV2 = await ethers.getContractFactory("TestZunamiUpgradeableV2", { signer: hacker });
        await expectRevert(
            upgrades.upgradeProxy(zunami.address, ZunamiV2),
            'Ownable: caller is not the owner'
        );
    });
})
