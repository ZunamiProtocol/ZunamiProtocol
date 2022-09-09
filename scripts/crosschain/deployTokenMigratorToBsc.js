async function main() {
    const tokenFrom = "0xFEdcBA60B3842e3F9Ed8BC56De171da5426AF8CF";
    const tokenTo = "0xeAC5e2b6F1d7eBF4a715a235e097b59ACa40b786";

    console.log('Start deploy TokenMigrator');
    const TokenMigrator = await ethers.getContractFactory('TokenMigrator');
    const params = [tokenFrom, tokenTo];
    const migrator = await TokenMigrator.deploy(...params);
    await migrator.deployed();
    console.log('TokenMigrator deployed to:', migrator.address, params);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
