const globalConfig = require('../config.json');
const { ethers } = require('hardhat');


const configStakeDaoAPS = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv, globalConfig.sdt],
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
    // const zunamiAPS = await ZunamiAPS.attach(''); // test

    await zunamiAPS.deployed();
    console.log('ZunamiAPS deployed to:', zunamiAPS.address);


    // const stableConverterAddress = "0x939d4051eD5447f3Dc542af93b7E343f19AEe469";
    // console.log('Stable converter deployed to:', stableConverterAddress);
    //
    // const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManager');
    // const rewardManager = await RewardManagerFactory.deploy(stableConverterAddress);
    // await rewardManager.deployed();
    //
    // const rewardManagerAddress = rewardManager.address;
    const rewardManagerAddress = '0xA94999dB7dAb9cA4478b36142D026d5f2db3B356';
    console.log('Reward manager deployed to:', rewardManagerAddress);

    //await deployAndLinkStrategy('VaultAPSStrat', zunamiAPS, undefined, globalConfig.token_aps);
    //await deployAndLinkStrategy('UzdFraxCurveStakeDao', zunamiAPS, rewardManagerAddress, configStakeDaoAPS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
