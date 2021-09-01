import { ethers } from "hardhat";
import { expect } from "chai";

const SUPPLY = "100000000000000";
const ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Zunami", function () {
    before(async function () {
        this.signers = await ethers.getSigners();
        this.owner = this.signers[0];
        this.alice = this.signers[1];
        this.bob = this.signers[2];
        this.carol = this.signers[3];

        this.LPToken = await ethers.getContractFactory("LPToken");
        this.Zunami = await ethers.getContractFactory("Zunami");
        this.CurveAaveConvex = await ethers.getContractFactory(
            "CurveAaveConvex"
        );
    });

    beforeEach(async function () {
        this.lp = await this.LPToken.deploy("LP", "LP");
        await this.lp.deployed();
        await this.lp.mint(this.owner.address, SUPPLY);
        this.zunami = await this.Zunami.deploy(this.lp.address);
        await this.zunami.deployed();
        await this.lp.grantRole(ADMIN_ROLE, this.zunami.address);
        this.strategy = await this.CurveAaveConvex.deploy();
        await this.strategy.deployed();
        this.referenceBlock = await provider.getBlockNumber();
    });

    it("should correctly init contracts", async function () {
        expect(await this.lp.balanceOf(this.owner.address)).to.be.equal(SUPPLY);
        const token = await this.strategy.tokens(0);
        expect(token).to.equal("0x6B175474E89094C44Da98b954EedeAC495271d0F");
    });
});
