require("@nomiclabs/hardhat-waffle");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

module.exports = {
  networks: {
      hardhat: {
          forking: {
              url: 'https://eth-mainnet.alchemyapi.io/v2/Dpwj4UKTaHOGzK4UzVNGUxd-EmIM_NaJ'
          }
      }
  },
  solidity: '0.8.0',
};

