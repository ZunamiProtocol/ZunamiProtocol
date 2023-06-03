import { ethers } from 'hardhat';
import { BigNumber } from 'bignumber.js';

async function main() {
    const zunamiAddr = '0xCaB49182aAdCd843b037bBF885AD56A3162698Bd'; // prod

    const zunamiAbi = [
        'function poolCount() external view returns (uint256)',
        'function lpPrice() external view returns (uint256)',
        'function totalHoldings() external view returns (uint256)',
        'function totalSupply() external view returns (uint256)',
        'function poolInfo(uint256 pid) external view returns (tuple(address, uint256, uint256))',
        'function defaultDepositPid() external view returns (uint256)',
        'function defaultWithdrawPid() external view returns (uint256)',
    ];
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_API_KEY);
    const zunami = new ethers.Contract(zunamiAddr, zunamiAbi, provider);




    const descriptions: any[] = [
        "B AComp 17259850",
        "AComp 17259850",
        "B AComp 17350213",
        "AComp 17350213",
        "B AComp 17405608",
        "AComp 17405608",
        "B I 17271184",
        "I 17271184",
        "B I 17271192",
        "I 17271192",
        "B I 17278366",
        "I 17278366",
        "B I 17315099",
        "I 17315099",
        "B I 17315375",
        "I 17315375",
        "B I 17366456",
        "I 17366456",
        "B I 17413328",
        "I 17413328",
        "B I 17429962",
        "I 17429962",
        "Current",
    ];

    const blocks: any[] = [
        17259849,
        17259850,

        17350212,
        17350213,

        17405607,
        17405608,

        17271183,
        17271184,

        17271191,
        17271192,

        17278365,
        17278366,

        17315098,
        17315099,

        17315374,
        17315375,

        17366455,
        17366456,

        17413327,
        17413328,

        17429961,
        17429962,
        await await provider.getBlockNumber()
    ];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const description = descriptions[i];

        const [zlpPriceInt, zunamiTotalHoldingsInt, zunamiTotalSupplyInt] = await Promise.all([
            zunami.lpPrice({ blockTag: block }),
            zunami.totalHoldings({ blockTag: block }),
            zunami.totalSupply({ blockTag: block })
        ]);

        const zlpPrice: BigNumber = new BigNumber(+zlpPriceInt).dividedBy(1e18);
        const zunamiTotalHoldings: BigNumber = new BigNumber(+zunamiTotalHoldingsInt).dividedBy(1e18);
        const zunamiTotalSupply: BigNumber = new BigNumber(+zunamiTotalSupplyInt).dividedBy(1e18);

        console.log(`Block: ${block} (${description})`);
        console.log(`Zunami APS LP: ${zlpPrice.toString()}`);
        console.log(`Zunami APS Total Holdings: ${zunamiTotalHoldings.toString()}`);
        console.log(`Zunami APS Total Supply: ${zunamiTotalSupply.toString()}`);
        console.log('');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
