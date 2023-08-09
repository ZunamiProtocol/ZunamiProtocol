const globalConfig = require('../config.json');
const { ethers } = require('hardhat');

async function main() {
    console.log('Start deploy withdrawer');

    const ZunamiWithdrawer = await ethers.getContractFactory('ZunamiWithdrawer');
    const withdrawer = await ZunamiWithdrawer.deploy();
    await withdrawer.deployed();
    const withdrawerAddr = withdrawer.address;

    console.log('Withdrawer deployed to:', withdrawerAddr);

    const tx = await withdrawer.transferOwnership("0xb056B9A45f09b006eC7a69770A65339586231a34");
    await tx.wait();
    console.log('Withdrawer owner changed to:', await withdrawer.owner());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
