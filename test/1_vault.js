const {expect} = require('chai');
const {waffle} = require('hardhat');

// get the signers
let owner; let addr1; let zunamiVaultContract; let testUSDTContract;

const setup = async () => {
    // deploy the test USDT first
    const TestUSDT = await ethers.getContractFactory('USDTTestCoin');
    testUSDTContract = await (await TestUSDT.deploy()).deployed();


    // then deploy the vault
    const ZunamiVault = await ethers.getContractFactory('Vault');
    const zunamiVault = await ZunamiVault.deploy(testUSDTContract.address);
    await zunamiVault.deployed();
    [owner, addr1, ...addrs] = await ethers.getSigners();
    return zunamiVault;
};


describe('Deploying the vault + USDT contracts', () => {
    before(async () => {
        zunamiVaultContract = await setup();
    });

    describe('Test vault contract deployment', () => {
        it('Should set the deployed vault to the correct owner', async () => {
            expect(await zunamiVaultContract.owner()).to.equal(owner.address);
            expect(await testUSDTContract.owner()).to.equal(owner.address);
        });
    });

    describe('Test vault deposit and withdrawal', () => {
        it('User should be able to deposit to the vault and get LP Tokens', async () => {
            const usdtDepositAmount = ethers.utils.parseEther('100');
            const lpTokensBal = await zunamiVaultContract.deposit(usdtDepositAmount);
            console.log(lpTokensBal);
            expect(lpTokensBal).to.be.gte(usdtDepositAmount);
        });

        // eslint-disable-next-line max-len
        it('User should be able to withdraw from the vault, burn the LP Tokens & get their initial deposit back', async () => {
            //  expect(await zunamiVaultContract.owner()).to.equal(owner.address);
            //   expect(await testUSDTContract.owner()).to.equal(owner.address);
        });
    });
});
