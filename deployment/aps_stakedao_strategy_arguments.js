const globalConfig = require('../config.json');

const config = {
    token: globalConfig.token_aps,
    rewards: [globalConfig.crv, globalConfig.sdt],
};
module.exports = [config];
