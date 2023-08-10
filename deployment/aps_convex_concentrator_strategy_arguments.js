const globalConfig = require('../config.json');

const config = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv],
};
module.exports = [config];
