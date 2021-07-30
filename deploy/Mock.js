module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        await deploy('DAI', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Dai Stablecoin', 'DAI', 18],
        });

        await deploy('USDC', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['USD Coin', 'USDC', 6],
        });

        await deploy('USDT', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Tether', 'USDT', 6],
        });
    };
};

module.exports.tags = ['token'];
