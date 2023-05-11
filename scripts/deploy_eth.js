const globalConfig = require('../config.json');
const { ethers } = require('hardhat');
const addrs = require("../test/address.json");

const configStakingConvexETH = {
    tokens: globalConfig.tokensETH,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster,
};

async function deployAndLinkStrategy(name, zunami, rewardManager, config) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);

    // await zunami.addPool(strategy.address);
    // console.log(`Added ${name} pool to Zunami`);

    await strategy.setZunami(zunami.address);
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);

    if (rewardManager) {
        await strategy.setRewardManager(rewardManager);
        console.log(`Set reward manager ${rewardManager}`);
    }
}

async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('ZunamiNative');
    const zunami = await Zunami.deploy(globalConfig.tokens);
    // const zunami = await Zunami.attach(''); // prod

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    await zunami.addTokens(
        [addrs.stablecoins.wEth, addrs.stablecoins.frxEth],
        [1, 1]
    );

    const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManagerNative');
    const rewardManager = await RewardManagerFactory.deploy();
    await rewardManager.deployed();

    const rewardManagerAddress = rewardManager.address;
    // const rewardManagerAddress = '';

    console.log('Reward manager deployed to:', rewardManagerAddress);

    await deployAndLinkStrategy(
        'frxEthStakingFraxCurveConvex',
        zunami,
        rewardManagerAddress,
        configStakingConvexETH
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
