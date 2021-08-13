const {ethers} = require('hardhat');

describe('ProfitablePool', function() {
    let profitablePool;
    const curvePoolAddress = '0x42d7025938bEc20B69cBae5A77421082407f053A';
    const convexPoolArray = [
        {
            pool: 'usdp',
            address: '0x24DfFd1949F888F91A0c8341Fc98a3F280a782a8',
        },
        {
            pool: 'dusd',
            address: '0x1992b82A8cCFC8f89785129D6403b13925d6226E',
        },
        {
            pool: 'frax',
            address: '0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e',
        },
        {
            pool: 'usdn',
            address: '0x4a2631d090e8b40bBDe245e687BF09e5e534A239',
        },
        {
            pool: 'lusd',
            address: '0x2ad92A7aE036a038ff02B96c88de868ddf3f8190',
        },
        {
            pool: 'ironbank',
            address: '0x3E03fFF82F77073cc590b656D42FceB12E4910A8',
        },
        {
            pool: 'busd',
            address: '0x602c4cD53a715D8a7cf648540FAb0d3a2d546560',
        },
        {
            pool: 'busdv2',
            address: '0xbD223812d360C9587921292D0644D18aDb6a2ad0',
        },
        {
            pool: 'saave',
            address: '0xF86AE6790654b70727dbE58BF1a863B270317fD0',
        },
        {
            pool: 'musd',
            address: '0xDBFa6187C79f4fE4Cda20609E75760C5AaE88e52',
        },
        {
            pool: 'rsv',
            address: '0xedfCCF611D7c40F43e77a1340cE2C29EEEC27205',
        },
        {
            pool: 'susd',
            address: '0x22eE18aca7F3Ee920D01F25dA85840D12d98E8Ca',
        },
        {
            pool: 'tusd',
            address: '0x308b48F037AAa75406426dACFACA864ebd88eDbA',
        },
        {
            pool: 'usdk',
            address: '0xa50e9071aCaD20b31cd2bbe4dAa816882De82BBe',
        },
    ];

    const convexPool = [convexPoolArray.length];
    const convexPoolAddress = [convexPoolArray.length];

    convexPoolArray.map((item, i) => {
        convexPool[i] = item.pool;
        convexPoolAddress[i] = item.address;
    });

    before(async function() {
        profitablePool = await ethers.getContractFactory('ProfitablePool');
        profitablePool = await profitablePool.deploy();
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
