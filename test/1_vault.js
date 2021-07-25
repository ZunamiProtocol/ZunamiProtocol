require("dotenv").config();

const { expect } = require('chai');
const { waffle } = require('hardhat');
const provider = waffle.provider;

const setup = async () => {
  const ZunamiVault = await ethers.getContractFactory('Vault');
  const zunamiVault = await ZunamiVault.deploy();
  await zunamiVault.deployed();
  return zunamiVault;
};


describe('Deploying the vault contract', () => {

  before(async () => {
    zunamiVaultContract = await setup();
  });

  describe('Test vault contract deployment', () => {

    it('Should set the deployed vault to the correct owner', async function () {
    
    });

    
   
  });

});
