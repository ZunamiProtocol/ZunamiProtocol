const Zunami = artifacts.require("ZunamiStablecoin");

module.exports = async (deployer, _network, accounts) => {
    await deployer.deploy(Zunami, accounts);
    const zallet = await Zunami.deployed();
};
