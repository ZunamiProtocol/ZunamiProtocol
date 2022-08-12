async function main() {
    const gatewayAddress = "0xFEdcBA60B3842e3F9Ed8BC56De171da5426AF8CF";

    console.log('Start deploy ZunamiDepositor');
    const ZunamiDepositor = await ethers.getContractFactory('ZunamiDepositorBUSD');
    const depositor = await ZunamiDepositor.deploy(
      gatewayAddress
    );
    await depositor.deployed();
    console.log('ZunamiDepositor deployed to:', depositor.address, gatewayAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
