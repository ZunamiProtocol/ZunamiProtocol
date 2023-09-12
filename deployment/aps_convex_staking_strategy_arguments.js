const globalConfig = require('../config.json');

const config = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv, globalConfig.cvx, globalConfig.fxs],
    booster: globalConfig.stakingBooster
};
module.exports = [config];
