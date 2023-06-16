const globalConfig = require('../config.json');
const { ethers } = require('hardhat');
const addrs = require("../test/address.json");

const configStakingConvexETH = {
    tokens: globalConfig.tokensETH,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster,
};

const configConvexETH = {
    tokens: globalConfig.tokensETH,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};


async function deployAndLinkStrategy(name, zunami, rewardManager, nativeConverter, config) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);

    let tx = await zunami.addPool(strategy.address);
    await tx.wait();
    console.log(`Added ${name} pool to Zunami`);

    tx = await strategy.setZunami(zunami.address);
    await tx.wait();
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);

    if (rewardManager) {
        tx = await strategy.setRewardManager(rewardManager);
        await tx.wait();
        console.log(`Set reward manager ${rewardManager}`);
    }

    if (nativeConverter) {
        tx = await strategy.setNativeConverter(nativeConverter);
        await tx.wait();
        console.log(`Set native convertor ${nativeConverter}`);
    }
}

async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('ZunamiNative');
    // const zunami = await Zunami.deploy();
    // await zunami.deployed();

    const zunami = await Zunami.attach('0x9dE83985047ab3582668320A784F6b9736c6EEa7'); // prod

    console.log('Zunami ETH deployed to:', zunami.address);

    // const tx = await zunami.addTokens(
    //     [addrs.stablecoins.wEth, addrs.stablecoins.frxEth],
    //     [1, 1]
    // );
    // await tx.wait();
    //
    // console.log('Zunami ETH tokens added');

    // const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManagerNative');
    // const rewardManager = await RewardManagerFactory.deploy();
    // await rewardManager.deployed();
    //
    // const rewardManagerAddress = rewardManager.address;
    const rewardManagerAddress = '0x66434474AF84fE23C927b0f08B28CEc43a1a9b31';
    console.log('Reward manager deployed to:', rewardManagerAddress);

    // const NativeConverterFactory = await ethers.getContractFactory('FraxEthNativeConverter');
    // const nativeConverter = await NativeConverterFactory.deploy();
    // await nativeConverter.deployed();
    // const nativeConverterAddress = nativeConverter.address;
    const nativeConverterAddress = "0xAe525CE04abe27c4D759C8E0E8b3b8AE36aa5d7e";

    console.log('Native frxETH converter deployed to:', nativeConverterAddress);

    // await deployAndLinkStrategy(
    //     'alEthFraxEthCurveConvex',
    //     zunami,
    //     rewardManagerAddress,
    //     nativeConverterAddress,
    //     configConvexETH
    // );

    await deployAndLinkStrategy(
        'sEthFraxEthCurveConvex',
        zunami,
        rewardManagerAddress,
        nativeConverterAddress,
        configConvexETH
    );

    // await deployAndLinkStrategy(
    //     'frxEthStakingFraxCurveConvex',
    //     zunami,
    //     rewardManagerAddress,
    //     undefined,
    //     configStakingConvexETH
    // );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
