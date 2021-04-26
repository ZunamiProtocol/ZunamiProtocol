const Main = artifacts.require('Main');

module.exports = async function(deployer, _network, accounts) {
    await deployer.deploy(Main);
};
