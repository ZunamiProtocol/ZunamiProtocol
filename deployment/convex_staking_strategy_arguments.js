const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster
};
module.exports = [config];
