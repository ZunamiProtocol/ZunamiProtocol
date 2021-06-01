const {ethers} = require('hardhat');

const fs = require('fs');

const unblockAddress = require('../test/tools/PathAndAddress.json').address;

const rewriteMainAddress = (address) => {
    const fileParse = JSON.parse(
        fs.readFileSync(`${__dirname}/../test/tools/PathAndAddress.json`, 'utf8'));
    fileParse.address.mainAddress = address;

    const file = JSON.stringify(fileParse);
    let newFile = String();
    for (let i = 0; i < file.length; i++) {
        newFile += file[i];
        if (file[i] === ',' || file[i] === '{' || file[i] === '}') {
            newFile += '\n';
        }
    }

    fs.writeFileSync(`${__dirname}/../test/tools/PathAndAddress.json`,
        newFile,
        {encoding: 'utf8', flag: 'w'});
    console.log('file with path update!');
};

const main = async () => {
    const Main = await ethers.getContractFactory('Main');
    const main = await Main.deploy();
    await main.deployed();

    const lockedAddr = [unblockAddress.holderUsdc, main.address];

    for (let address of lockedAddr) {
        await ethers.provider.send('hardhat_impersonateAccount',
            [address]);

        await ethers.getSigner(address);
    }

    rewriteMainAddress(main.address);

    console.log(`Unblock addresses ${lockedAddr}`);
};


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
