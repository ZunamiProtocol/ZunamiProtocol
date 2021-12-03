async function main() {
    const Zunami = await ethers.getContractFactory("Zunami");
    const zunami = await Zunami.deploy();
    await zunami.deployed();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
