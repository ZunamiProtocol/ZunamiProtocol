const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    rewards: [globalConfig.crv, globalConfig.sdt],
};
module.exports = [config];
