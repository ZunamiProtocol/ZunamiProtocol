async function main() {
    console.log("Start deploy");
    const Zunami = await ethers.getContractFactory("Zunami");
    const zunami = await Zunami.deploy();
    await zunami.deployed();
    console.log("Zunami deployed to:", zunami.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
