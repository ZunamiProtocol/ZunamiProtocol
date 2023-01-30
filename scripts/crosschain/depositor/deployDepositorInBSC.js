async function main() {
    const gatewayAddress = '0xeAC5e2b6F1d7eBF4a715a235e097b59ACa40b786';

    console.log('Start deploy ZunamiDepositor');
    const ZunamiDepositor = await ethers.getContractFactory('ZunamiDepositorBUSD');
    const depositor = await ZunamiDepositor.deploy(gatewayAddress);
    await depositor.deployed();
    console.log('ZunamiDepositor deployed to:', depositor.address, gatewayAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
