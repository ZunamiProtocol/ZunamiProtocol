async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('Zunami');
    const OUSDCurveConvex = await ethers.getContractFactory('OUSDCurveConvex');
    const USDPCurveConvex = await ethers.getContractFactory('USDPCurveConvex');

    const ousd = await OUSDCurveConvex.deploy();
    const usdp = await USDPCurveConvex.deploy();
    const zunami = await Zunami.deploy();

    await zunami.deployed();
    await ousd.deployed();
    await usdp.deployed();
    console.log('Zunami deployed to:', zunami.address);
    console.log('OUSD strategy deployed to:', ousd.address);
    console.log('USDP strategy deployed to:', usdp.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
