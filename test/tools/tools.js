const {deployments, ethers} = require('hardhat');

exports.Ticker = {
    'dai': ethers.utils.formatBytes32String('dai'),
    'usdc': ethers.utils.formatBytes32String('usdc'),
    'usdt': ethers.utils.formatBytes32String('usdt'),
    'curve': ethers.utils.formatBytes32String('a3CRV'),
    'yearn': ethers.utils.formatBytes32String('saCRV'),
    'SusdPool': ethers.utils.formatBytes32String('crvPlain3andSUSD'),
    'DusdPool': ethers.utils.formatBytes32String('dusd3CRV'),
    'Invalid_Ticker': ethers.utils.formatBytes32String('Invalid_Ticker'),
};

exports.setupTestAllStrategy = deployments.createFixture(
    async ({deployments, getNamedAccounts, ethers}) => {
        await deployments.fixture('strategy');
        const {USDC, holderUSDC} = await getNamedAccounts();

        const StrategyCurveAave = await deployments.get('StrategyCurveAave');
        const StrategyKeeperDao = await deployments.get('StrategyKeeperDao');
        const StrategyMStable = await deployments.get('StrategyMStable');
        const StrategyYearnAlusd = await deployments.get('StrategyYearnAlusd');

        const sCurveAave = await ethers.getContractAt(
            'StrategyCurveAave', StrategyCurveAave.address, holderUSDC);
        const sKeeperDao = await ethers.getContractAt(
            'StrategyKeeperDao', StrategyKeeperDao.address, holderUSDC);
        const sMStable = await ethers.getContractAt(
            'StrategyMStable', StrategyMStable.address, holderUSDC);
        const sYearnAlusd = await ethers.getContractAt(
            'StrategyYearnAlusd', StrategyYearnAlusd.address, holderUSDC);

        const usdc = await ethers.getContractAt('MockERC20', USDC, holderUSDC);

        return {
            holderUSDC,
            sCurveAave,
            sKeeperDao,
            sMStable,
            sYearnAlusd,
            usdc,
        };
    }
);
