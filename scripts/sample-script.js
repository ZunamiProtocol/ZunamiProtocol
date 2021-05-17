const {ethers} = require('hardhat');


const main = async () => {
    const Main = await ethers.getContractFactory('Main');
    const main = await Main.deploy();
    await main.deployed();

    const lockedAddr = ['0xF977814e90dA44bFA03b6295A0616a897441aceC', main.address];

    await ethers.provider.send('hardhat_impersonateAccount',
        [lockedAddr[0]]);

    await ethers.provider.send('hardhat_impersonateAccount',
        [lockedAddr[1]]);

    await ethers.getSigner(lockedAddr[1]);
    await ethers.getSigner(lockedAddr[0]);

    console.log(`Unblock addresses ${lockedAddr}`);
};


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });