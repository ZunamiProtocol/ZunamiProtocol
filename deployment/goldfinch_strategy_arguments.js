const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    curve3Pool: globalConfig.curve3Pool,
    seniorPool: globalConfig.goldfinchSeniorPool,
    stakingRewards: globalConfig.goldfinchStakingRewards,
    gfi: globalConfig.gfi,
    fidu: globalConfig.fidu,
    router: globalConfig.router,
    gfiToFeeTokenPath: globalConfig.gfiToFeeTokenPath,
};
module.exports = [config];