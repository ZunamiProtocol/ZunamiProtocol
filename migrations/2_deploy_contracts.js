const Zunami = artifacts.require("ZUN");

module.exports = async function(deployer, _network, accounts) {
  await deployer.deploy(Zunami, accounts[0]);
   const wallet = await Zunami.deployed();
};
