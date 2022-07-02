const config = require('../config.json');

async function deployAndLinkStrategy(name, zunami) {
    const factory = await ethers.getContractFactory(name);
    const strategy = await factory.deploy(config.tokens_polygon);
    // const strategy = await factory.attach("0x346E74Dc9935a9b02Eb34fB84658a66010fA056D");
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
    const zunami = await Zunami.deploy(config.tokens_polygon);
    // const zunami = await Zunami.attach("0x9B43E47BEc96A9345cd26fDDE7EFa5F8C06e126c");

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    await deployAndLinkStrategy('RebalancingStrat', zunami);

    await zunami.setDefaultDepositPid(0);
    console.log('Zunami setDefaultDepositPid to:', 0);
    await zunami.setDefaultWithdrawPid(0);
    console.log('Zunami setDefaultWithdrawPid to:', 0);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
