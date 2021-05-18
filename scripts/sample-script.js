const {ethers} = require('hardhat');
const fs = require('fs');

const rewriteMainAddress = (address) => {
    const file = JSON.parse(
        fs.readFileSync(`${__dirname}/../test/PathAndAddress.json`, 'utf8'));
    file.address.mainAddress = address;

    const stringFile = JSON.stringify(file);
    let newFile = String();
    for (let i = 0; i < stringFile.length; i++) {
        newFile += stringFile[i];
        if (stringFile[i] === ',' || stringFile[i] === '{' || stringFile[i] === '}') {
            newFile += '\n';
        }
    }

    fs.writeFileSync(`${__dirname}/../test/PathAndAddress.json`,
        newFile,
        {encoding: 'utf8', flag: 'w'});
    console.log('file with path update!');
};

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

    rewriteMainAddress(main.address);

    console.log(`Unblock addresses ${lockedAddr}`);
};


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
