const Zunami = artifacts.require("ZunamiStablecoin");

module.exports = async function(deployer) {
  await deployer.deploy(Zunami);
  await deployer.deploy(accounts[0]);
};
