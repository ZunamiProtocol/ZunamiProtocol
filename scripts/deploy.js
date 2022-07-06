const config = require('../config.json');

async function deployAndLinkPlainStrategy(name, zunami) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy();
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);
    // await zunami.addPool(strategy.address);
    // console.log(`Added ${name} pool to Zunami`);
    await strategy.setZunami(zunami.address);
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);
}

async function deployAndLinkConvexStrategy(name, zunami) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);
    // await zunami.addPool(strategy.address);
    // console.log(`Added ${name} pool to Zunami`);
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
    // const zunami = await Zunami.deploy(config.tokens);
    const zunami = await Zunami.attach('0x2ffCC661011beC72e1A9524E12060983E74D14ce');

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    // await deployAndLinkPlainStrategy("AnchorStrat", zunami);
    // await deployAndLinkPlainStrategy('RebalancingStrat', zunami);
    // await deployAndLinkConvexStrategy('MIMCurveConvex', zunami);
    // await deployAndLinkConvexStrategy('USDNCurveConvex', zunami);
    // await deployAndLinkConvexStrategy('LUSDCurveConvex', zunami);
    // await deployAndLinkConvexStrategy('DUSDCurveConvex', zunami);
    // await deployAndLinkStrategy('PUSDCurveConvex', zunami);
    await deployAndLinkConvexStrategy('USDDCurveConvex', zunami);

    // await linkStrategy("USDNCurveConvex", "0xeDD04c680f9751Db7aF9f5082328Bc9D954316B2", zunami)
    // await linkStrategy("LUSDCurveConvex", "0x9903ABbd0006350115D15e721f2d7e3eb6f13b97", zunami)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
