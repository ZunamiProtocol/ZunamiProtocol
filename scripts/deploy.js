async function main() {
    const LPToken = await ethers.getContractFactory("LPToken");
    const Zunami = await ethers.getContractFactory("Zunami");
    const lpToken = await LP.deploy("LP", "LP");
    await lpToken.deployed();
    const zunami = await Zunami.deploy(lpToken.address);
    await zunami.deployed();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
