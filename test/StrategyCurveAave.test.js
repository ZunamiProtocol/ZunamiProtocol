const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestAllStrategy, Ticker} = require('./tools/tools');

describe('StrategyCurveAave test', () => {
    let sCurveAave;
    let usdc;
    let holderUSDC;

    beforeEach(async () => {
        const config = await setupTestAllStrategy();
        sCurveAave = config.sCurveAave;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });
});
