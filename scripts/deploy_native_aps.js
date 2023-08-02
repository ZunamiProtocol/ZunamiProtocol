const globalConfig = require('../config.json');
const { ethers } = require('hardhat');

const configConvexNativeAPS = {
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

    await zunamiAPS.addPool(strategy.address);
    console.log(`Added ${name} pool to Zunami`);

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
    // const zunamiAPS = await ZunamiAPS.deploy();
    const zunamiAPS = await ZunamiAPS.attach('0x0b49D1Dd3F045c986F7816c2Ad56F01D8FB29C82'); // prod

    await zunamiAPS.deployed();
    console.log('ZunamiNativeAPS deployed to:', zunamiAPS.address);

    // const NativeConverterFactory = await ethers.getContractFactory('FraxEthNativeConverter');
    // const nativeConverter = await NativeConverterFactory.deploy();
    // await nativeConverter.deployed();
    // const nativeConverterAddress = nativeConverter.address;
    const nativeConverterAddress = "0xAe525CE04abe27c4D759C8E0E8b3b8AE36aa5d7e";
    console.log('Native frxETH converter deployed to:', nativeConverterAddress);

    // const RewardManagerFactory = await ethers.getContractFactory('SellingCurveRewardManagerFrxEthV2');
    // const rewardManager = await RewardManagerFactory.deploy(
    //   nativeConverterAddress
    // );
    // await rewardManager.deployed();
    // const rewardManagerAddress = rewardManager.address;
    const rewardManagerAddress = '0xded9e5A44d192054A19fFDa988382e2B2199E5B9';
    console.log('Reward manager deployed to:', rewardManagerAddress);

    // await deployAndLinkStrategy('VaultAPSStrat', zunamiAPS, undefined, globalConfig.token_eth_aps);
    // await deployAndLinkStrategy('zEthFrxEthCurveConvex', zunamiAPS, rewardManagerAddress, configConvexNativeAPS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
