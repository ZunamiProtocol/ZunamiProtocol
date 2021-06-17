const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestAllStrategy, Ticker} = require('./tools/tools');

describe('StrategyMStable test', () => {
    let sMStable;
    let usdc;
    let holderUSDC;

    beforeEach(async () => {
        const config = await setupTestAllStrategy();
        sMStable = config.sMStable;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });
});
