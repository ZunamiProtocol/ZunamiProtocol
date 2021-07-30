module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const controller = await deploy('Controller', {
        from: deployer,
        log: true,
    });

    await deploy('ZunamiVauli', {
        from: deployer,
        log: true,
        args: []
    });
};

module.exports.tags = ['main contracts'];
