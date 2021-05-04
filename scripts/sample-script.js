const hre = require('hardhat');
const {ethers} = require('hardhat');

const Stableabi = require('../OtherAbi/StableToken.json');

 const main = async () => {

  await ethers.provider.send("hardhat_impersonateAccount", ['0xF977814e90dA44bFA03b6295A0616a897441aceC']);

  await ethers.getSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC');

  const Main = await hre.ethers.getContractFactory('Main');
  const main = await Main.deploy();

  await main.deployed();

  console.log('Greeter deployed to:", main.address');
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
