const constants = require("./constants.json");

async function main() {
    console.log('Start deploy');
    const Zunami = await ethers.getContractFactory('Zunami');
    const USDNCurveConvex = await ethers.getContractFactory('USDNCurveConvex');

    const usdn = await USDNCurveConvex.deploy();
    const zunami = await Zunami.deploy([constants.daiAddress, constants.usdcAddress, constants.usdtAddress]);

    await zunami.deployed();
    await usdn.deployed();
    console.log('Zunami deployed to:', zunami.address);
    console.log('USDN strategy deployed to:', usdn.address);

    await zunami.addPool(usdn.address);
    console.log('Added USDN pool to Zunami');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
