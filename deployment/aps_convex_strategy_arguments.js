const globalConfig = require('../config.json');

const config = {
    token: globalConfig.token_aps,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    booster: globalConfig.booster,
};
module.exports = [config];
