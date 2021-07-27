module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const controller = await deploy('Controller', {
        from: deployer,
        log: true,
    });

    await deploy('ZunamiVault', {
        from: deployer,
        log: true,
        arg: [
            controller.address,
        ],
    });
};

module.exports.tags = ['ZunamiContracts'];
