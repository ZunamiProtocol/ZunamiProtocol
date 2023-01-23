

async function main() {
    const Zunami = await ethers.getContractFactory('Zunami');
    const zunami = await Zunami.attach('0x2ffCC661011beC72e1A9524E12060983E74D14ce');

    const Strat = await ethers.getContractFactory('LUSDCurveConvex');

    await zunami.deployed();
    console.log('Zunami deployed to:', zunami.address);

    const newAdmin = '0xb056B9A45f09b006eC7a69770A65339586231a34';
    const poolCount = await zunami.poolCount();
    for (let i = 0; i <= poolCount; i++) {
        const poolInfo = await zunami.poolInfo(i);
        const stratAddr = poolInfo["strategy"];
        const strat = await Strat.attach(stratAddr);
        console.log("Strat id", i);
        console.log("Strat addr", stratAddr);
        console.log("Fee distributor before", await strat.feeDistributor());
        let tx = await strat.changeFeeDistributor(newAdmin);
        await tx.wait();
        console.log("Fee distributor after", await strat.feeDistributor());
        console.log("Strat owner before", await strat.owner());
        tx = await strat.transferOwnership(newAdmin);
        await tx.wait();
        console.log("Strat owner after", await strat.owner());
        console.log(" ");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
