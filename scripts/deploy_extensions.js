const globalConfig = require('../config.json');
const { ethers } = require('hardhat');

async function main() {
    console.log('Start deploy extensions');

    const zunamiAddr = '0x2ffCC661011beC72e1A9524E12060983E74D14ce'; // prod
    // const zunamiAddr = '0x932370b862599798f3D9A88C59D3D23cc5d07197'; // test

    console.log('Zunami address:', zunamiAddr);

    // const FraxUsdcStableConverter = await ethers.getContractFactory('FraxUsdcStableConverter');
    // const stableConverter = await FraxUsdcStableConverter.deploy();
    // await stableConverter.deployed();
    // const stableConverterAddr = stableConverter.address;

    const stableConverterAddr = '0xE2152984056d410E96688e55B16C84CCa95831BD';
    console.log('FRAX-USDC stable converter deployed to:', stableConverterAddr);

    const ZunamiFraxExtension = await ethers.getContractFactory('ZunamiFraxExtension');
    const fraxExtension = await ZunamiFraxExtension.deploy(zunamiAddr, stableConverterAddr);
    await fraxExtension.deployed();

    const fraxExtensionAddr = fraxExtension.address;

    console.log('Frax Zunami Extension deployed to:', fraxExtensionAddr);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
