const globalConfig = require('../config.json');
const { ethers } = require('hardhat');

const configConvexAPS = {
    token: globalConfig.token_eth_aps,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};

async function deployAndLinkStrategy(name, zunamiAPS, rewardManager, config) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);

    // await zunamiAPS.addPool(strategy.address);
    // console.log(`Added ${name} pool to Zunami`);

    let tx = await strategy.setZunami(zunamiAPS.address);
    await tx.wait();
    console.log(`Set zunami address ${zunamiAPS.address} in ${name} strategy`);

    if (rewardManager) {
        tx = await strategy.setRewardManager(rewardManager);
        await tx.wait();
        console.log(`Set reward manager ${rewardManager}`);
    }
}

async function main() {
    console.log('Start deploy');
    const ZunamiAPS = await ethers.getContractFactory('ZunamiNativeAPS');
    const zunamiAPS = await ZunamiAPS.deploy();
    // const zunamiAPS = await ZunamiAPS.attach(''); // prod

    await zunamiAPS.deployed();
    console.log('ZunamiNativeAPS deployed to:', zunamiAPS.address);


    const RewardManagerFactory = await ethers.getContractFactory('CommissionSellingFraxNativeCurveRewardManager');
    const rewardManager = await RewardManagerFactory.deploy();
    await rewardManager.deployed();
    //
    const rewardManagerAddress = rewardManager.address;
    // const rewardManagerAddress = '';
    console.log('Reward manager deployed to:', rewardManagerAddress);

    await deployAndLinkStrategy('VaultAPSStrat', zunamiAPS, undefined, globalConfig.token_eth_aps);
    await deployAndLinkStrategy('zEthFraxCurveConvex', zunamiAPS, rewardManagerAddress, configConvexAPS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
