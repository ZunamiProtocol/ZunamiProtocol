const globalConfig = require('../config.json');
const { ethers } = require('hardhat');

const configConvex = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};

const configStakingConvex = {
    tokens: globalConfig.tokens,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster,
};

const configStakeDao = {
    tokens: globalConfig.tokens,
    rewards: [globalConfig.crv, globalConfig.sdt],
};

async function deployAndLinkStrategy(name, zunami, rewardManager, stableConverter, config) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);

    // await zunami.addPool(strategy.address);
    // console.log(`Added ${name} pool to Zunami`);

    await strategy.setZunami(zunami.address);
    if (rewardManager) {
        await strategy.setRewardManager(rewardManager);
        console.log(`Set reward manager ${rewardManager}`);
    }
    if (stableConverter) {
        await strategy.setStableConverter(stableConverter);
        console.log(`Set stable convertor ${stableConverter}`);
    }
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);
}

async function linkStrategy(name, address, zunami) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.attach(address);
    await strategy.deployed();

    await strategy.setZunami(zunami.address);
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);
}

async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('Zunami');
    // const zunami = await Zunami.deploy(globalConfig.tokens);
    const zunami = await Zunami.attach('0x2ffCC661011beC72e1A9524E12060983E74D14ce'); // prod
    // const zunami = await Zunami.attach('0x932370b862599798f3D9A88C59D3D23cc5d07197'); // test

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    // const StableConverterFactory = await ethers.getContractFactory('StableConverter');
    // const stableConverter = await StableConverterFactory.deploy();
    // await stableConverter.deployed();
    // const stableConverterAddress = stableConverter.address;

    const stableConverterAddress = "0x939d4051eD5447f3Dc542af93b7E343f19AEe469";
    console.log('Stable converter deployed to:', stableConverterAddress);

    const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManager');
    const rewardManager = await RewardManagerFactory.deploy(stableConverterAddress);
    await rewardManager.deployed();

    const rewardManagerAddress = rewardManager.address;
    // const rewardManagerAddress = '0x8cC045ea0cb956a01E802f8e4d09bb8B47e696DE';

    console.log('Reward manager deployed to:', rewardManagerAddress);

    // await deployAndLinkStrategy('RebalancingStrat', zunami, undefined, undefined, globalConfig.tokens);
    // await deployAndLinkStrategy('MIMCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('USDNCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('LUSDCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('DUSDCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('PUSDCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('USDDCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('DolaCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('LUSDFraxCurveConvex', zunami, undefined, undefined, configConvex);
    // await deployAndLinkStrategy('MIMCurveStakeDao', zunami, rewardManagerAddress, stableConverterAddress, configStakeDao);
    // await deployAndLinkStrategy(
    //     'XAIStakingFraxCurveConvex',
    //     zunami,
    //     rewardManagerAddress,
    //     stableConverterAddress,
    //     configStakingConvex
    // );

    // await linkStrategy("USDNCurveConvex", "0xeDD04c680f9751Db7aF9f5082328Bc9D954316B2", zunami)
    // await linkStrategy("LUSDCurveConvex", "0x9903ABbd0006350115D15e721f2d7e3eb6f13b97", zunami)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
