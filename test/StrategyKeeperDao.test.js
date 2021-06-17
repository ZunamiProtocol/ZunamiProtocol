const chai = require('chai');
const {solidity} = require('ethereum-waffle');
chai.use(solidity).use(require('chai-as-promised')).should();

const {setupTestAllStrategy, Ticker} = require('./tools/tools');

describe('StrategyKeeperDao test', () => {
    let sKeeperDao;
    let usdc;
    let holderUSDC;

    beforeEach(async () => {
        const config = await setupTestAllStrategy();
        sKeeperDao = config.sKeeperDao;
        usdc = config.usdc;
        holderUSDC = config.holderUSDC;
    });
});
