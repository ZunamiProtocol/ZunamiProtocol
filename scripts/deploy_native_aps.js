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
    // const nativeConverterAddress = "0xAe525CE04abe27c4D759C8E0E8b3b8AE36aa5d7e";
    // console.log('Native frxETH converter deployed to:', nativeConverterAddress);
    //
    // const zstableAddr = "0xe47f1CD2A37c6FE69e3501AE45ECA263c5A87b2b";
    // console.log('zStable is:', zstableAddr);
    //
    // const feeCollectorAddr = "0xb056B9A45f09b006eC7a69770A65339586231a34";
    // console.log('feeCollector is:', feeCollectorAddr);

    // const RewardManagerFactory = await ethers.getContractFactory('CommissionSellingCurveRewardManagerFrxEth');
    // const rewardManager = await RewardManagerFactory.deploy(
    //   nativeConverterAddress,
    //   zstableAddr,
    //   feeCollectorAddr
    // );
    // await rewardManager.deployed();
    // const rewardManagerAddress = rewardManager.address;
    const rewardManagerAddress = '0xF6A9a9dD2ddAF055A2e27EC63D282f63D30f2A5e';
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
