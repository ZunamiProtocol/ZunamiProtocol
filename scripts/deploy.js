const config = require('../config.json');

async function deployAndLinkStrategy(name, zunami) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config);
    await strategy.deployed();
    console.log(`${name} strategy deployed to: ${strategy.address}`);
    await zunami.addPool(strategy.address);
    console.log(`Added ${name} pool to Zunami`);
    await strategy.setZunami(zunami.address);
    console.log(`Set zunami address ${zunami.address} in ${name} strategy`);
}

async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('Zunami');
    const zunami = await Zunami.deploy(config.tokens);

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    await deployAndLinkStrategy('USDNCurveConvex', zunami);
    await deployAndLinkStrategy('DUSDCurveConvex', zunami);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
