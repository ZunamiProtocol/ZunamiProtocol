const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestAllStrategy, Ticker} = require('./tools/tools');

describe('StrategyYearnAlusd test', () => {
    let sYearnAlusd;
    let usdc;
    let holderUSDC;

    beforeEach(async () => {
        const config = await setupTestAllStrategy();
        sYearnAlusd = config.sYearnAlusd;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });
});
