const { ethers } = require('hardhat');

const snapshotHelperConfig = require('../config.json').views.snapshotHelper;

const config = [
    snapshotHelperConfig.uzdFraxbp3crv,
    snapshotHelperConfig.uzdFraxbp3CrvGauge,
    snapshotHelperConfig.convexUzdFraxbp3Crv,
    snapshotHelperConfig.sdUzdFraxbp3crvVaultGauge
];

async function main() {
    console.log("Start snapshot helper deploy");
    const snapshotHelperFactory = await ethers.getContractFactory('SnapshotHelper');
    const snapshotHelper = await snapshotHelperFactory.deploy(config);
    await snapshotHelper.deployed();
    console.log('SnapshotHelper deployed to:', snapshotHelper.address);

    const poolGaugeCount = await snapshotHelper.poolGaugeCount()
    console.log('Pool gauge count:', poolGaugeCount.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
