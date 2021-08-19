const {ethers} = require('hardhat');

describe('ProfitablePool', function() {
    let profitablePool;
    const curvePoolAddress = '0x42d7025938bEc20B69cBae5A77421082407f053A';
    const convexPoolArray = require('./json/ConvexPoolArray.json');
    const convexPoolAddress = [convexPoolArray.length];
    convexPoolArray.map((item, i) => {
        convexPoolAddress[i] = item.address;
    });

    before(async function() {
        const ProfitablePool = await ethers.getContractFactory('ProfitablePool');
        profitablePool = await (await ProfitablePool.deploy()).deployed();
    });

    describe('Deployment', function() {
        it('Get profitable pool', async function() {
            const maxRewardPool =
                await profitablePool.getProfitablePool(convexPoolAddress, curvePoolAddress);

            await profitablePool.setProfitableAddress(maxRewardPool);
            const profitableAddress = await profitablePool.profitablePoolAddress();
            console.log('Max reward pool address:', profitableAddress.toString());
        });
    });
});
