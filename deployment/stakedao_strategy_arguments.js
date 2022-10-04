const globalConfig = require('../config.json');

const config = {
    tokens: globalConfig.tokens,
    crv: globalConfig.crv,
    sdt: globalConfig.sdt,
    router: globalConfig.router,
    crvToFeeTokenPath: globalConfig.crvToUsdtPath,
    sdtToFeeTokenPath: globalConfig.sdtToUsdtPath,
};
module.exports = [config];
