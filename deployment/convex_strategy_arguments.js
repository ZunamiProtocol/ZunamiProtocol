const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    cvx: globalConfig.cvx,
    router: globalConfig.router,
    booster: globalConfig.booster,
    cvxToFeeTokenPath: globalConfig.cvxToUsdcPath,
    crvToFeeTokenPath: globalConfig.crvToUsdcPath,
};
module.exports = [config];
