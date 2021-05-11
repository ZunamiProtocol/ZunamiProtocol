const hre = require('hardhat');
const {ethers} = require('hardhat');

const lockedAddr = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
const main = async () => {
    await ethers.provider.send('hardhat_impersonateAccount',
        [lockedAddr]);

    await ethers.getSigner(lockedAddr);

    const Main = await hre.ethers.getContractFactory('Main');
    const main = await Main.deploy();

    await main.deployed();

    console.log('Greeter deployed to:', main.address);
};


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
