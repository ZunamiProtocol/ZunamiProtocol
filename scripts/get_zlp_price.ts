import { ethers } from 'hardhat';
import { BigNumber } from 'bignumber.js';

async function main() {
    const zunamiAddr = '0x2ffCC661011beC72e1A9524E12060983E74D14ce'; // prod
    // const zunamiAddr = '0x932370b862599798f3D9A88C59D3D23cc5d07197'; // test

    const zunamiAbi = [
        'function poolCount() external view returns (uint256)',
        'function lpPrice() external view returns (uint256)',
        'function totalHoldings() external view returns (uint256)',
        'function poolInfo(uint256 pid) external view returns (tuple(address, uint256, uint256))',
        'function defaultDepositPid() external view returns (uint256)',
        'function defaultWithdrawPid() external view returns (uint256)',
    ];
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_API_KEY);
    const zunami = new ethers.Contract(zunamiAddr, zunamiAbi, provider);

    const descriptions: any[] = [
        "Before MEV",
        "After MEV",
        "After Flash",
        "Current",
    ];

    const blocks: any[] = [
        16491516,
        16491517,
        16549314,
        await await provider.getBlockNumber()
    ];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const description = descriptions[i];

        const [zlpPriceInt, zunamiTotalHoldingsInt] = await Promise.all([
            zunami.lpPrice({ blockTag: block }),
            zunami.totalHoldings({ blockTag: block })
        ]);

        const zlpPrice: BigNumber = new BigNumber(+zlpPriceInt).dividedBy(1e18);
        const zunamiTotalHoldings: BigNumber = new BigNumber(+zunamiTotalHoldingsInt).dividedBy(1e18);

        console.log(`Block: ${block} (${description})`);
        console.log(`Zunami LP: ${zlpPrice.toString()}`);
        console.log(`Zunami Total Holdings: ${zunamiTotalHoldings.toString()}`);
        console.log('');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
