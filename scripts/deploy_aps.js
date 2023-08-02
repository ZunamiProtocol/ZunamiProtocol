const globalConfig = require('../config.json');
const { ethers } = require('hardhat');


const configStakeDaoAPS = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv, globalConfig.sdt],
};

const configConvexAPS = {
    token: globalConfig.token_aps,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};

const configStakingConvexAPS = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster,
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
    const ZunamiAPS = await ethers.getContractFactory('ZunamiAPS');
    // const zunamiAPS = await ZunamiAPS.deploy(globalConfig.token_aps);
    const zunamiAPS = await ZunamiAPS.attach('0xCaB49182aAdCd843b037bBF885AD56A3162698Bd'); // prod

    await zunamiAPS.deployed();
    console.log('ZunamiAPS deployed to:', zunamiAPS.address);

    // const stableConverterAddress = "0xce5c753716607110ce702042f080580f5c29f892";
    // console.log('Stable converter deployed to:', stableConverterAddress);
    //
    // const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManagerV2');
    // const rewardManager = await RewardManagerFactory.deploy(stableConverterAddress);
    // await rewardManager.deployed();
    //
    // const rewardManagerAddress = rewardManager.address;
    const rewardManagerAddress = '0x6349f12EDA78bf9ad33c7F0C2620a98Cb3790770';
    console.log('Reward manager deployed to:', rewardManagerAddress);

    //await deployAndLinkStrategy('VaultAPSStrat', zunamiAPS, undefined, globalConfig.token_aps);
    //await deployAndLinkStrategy('UzdFraxCurveStakeDao', zunamiAPS, rewardManagerAddress, configStakeDaoAPS);
    // await deployAndLinkStrategy('UzdFraxCurveConvex', zunamiAPS, rewardManagerAddress, configConvexAPS);
    // await deployAndLinkStrategy('UzdStakingFraxCurveConvex', zunamiAPS, rewardManagerAddress, configStakingConvexAPS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
