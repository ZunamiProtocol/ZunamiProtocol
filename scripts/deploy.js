const globalConfig = require('../config.json');

const configConvex = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    router: globalConfig.router,
    booster: globalConfig.booster,
    cvxToFeeTokenPath: globalConfig.cvxToUsdcPath,
    crvToFeeTokenPath: globalConfig.crvToUsdcPath,
};

const configStakeDao = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    sdt: globalConfig.sdt,
    router: globalConfig.router,
    crvToFeeTokenPath: globalConfig.crvToUsdcPath,
    sdtToFeeTokenPath: globalConfig.sdtToUsdtPath,
};

async function deployAndLinkStrategy(name, zunami, config) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);
    await zunami.addPool(strategy.address);
    console.log(`Added ${name} pool to Zunami`);
    await strategy.setZunami(zunami.address);
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
    
    // await deployAndLinkStrategy('RebalancingStrat', zunami, globalConfig.tokens);
    // await deployAndLinkStrategy('MIMCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('USDNCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('LUSDCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('DUSDCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('PUSDCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('USDDCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('DolaCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('LUSDFraxCurveConvex', zunami, configConvex);
    // await deployAndLinkStrategy('MIMCurveStakeDao', zunami, configStakeDao);

    // await linkStrategy("USDNCurveConvex", "0xeDD04c680f9751Db7aF9f5082328Bc9D954316B2", zunami)
    // await linkStrategy("LUSDCurveConvex", "0x9903ABbd0006350115D15e721f2d7e3eb6f13b97", zunami)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
