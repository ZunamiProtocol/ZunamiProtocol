module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await deploy('StrategyCurveAave', {
        from: deployer,
        log: true,
    });

    await deploy('StrategyYearnAlusd', {
        from: deployer,
        log: true,
    });
};

module.exports.tags = ['strategy'];
