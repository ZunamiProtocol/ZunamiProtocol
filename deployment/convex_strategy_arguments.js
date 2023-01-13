const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};
module.exports = [config];
