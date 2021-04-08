const Zunami = artifacts.require("ZunamiStablecoin");

module.exports = async function(deployer, _network, accounts) {
  await deployer.deploy(Zunami, accounts[0]);
   const wallet = await Zunami.deployed();
};
