import { ethers } from "hardhat";
import { expect } from "chai";

const SUPPLY = "100000000000000";
const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Zunami", function () {
    before(async function () {
        this.signers = await ethers.getSigners();
        this.owner = this.signers[0];
        this.alice = this.signers[1];
        this.bob = this.signers[2];
        this.carol = this.signers[3];

        this.Zunami = await ethers.getContractFactory("Zunami");
        this.CurveAaveConvex = await ethers.getContractFactory(
            "CurveAaveConvex"
        );
    });

    beforeEach(async function () {
        this.zunami = await this.Zunami.deploy();
        await this.zunami.deployed();
        this.strategy = await this.CurveAaveConvex.deploy();
        await this.strategy.deployed();
        await this.strategy.setZunami(this.zunami.address);
        await this.zunami.updateStrategy(this.strategy.address);
        this.referenceBlock = await provider.getBlockNumber();
    });

    it("should correctly init contracts", async function () {
        const token = await this.strategy.tokens(0);
        expect(token).to.equal("0x6B175474E89094C44Da98b954EedeAC495271d0F");
    });
});
