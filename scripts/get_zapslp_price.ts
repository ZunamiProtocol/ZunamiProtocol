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

    const blocks: any[] = [
        17821889,
        17821890,
        await await provider.getBlockNumber()
    ];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        const [zlpPriceInt, zunamiTotalHoldingsInt, zunamiTotalSupplyInt] = await Promise.all([
            zunami.lpPrice({ blockTag: block }),
            zunami.totalHoldings({ blockTag: block }),
            zunami.totalSupply({ blockTag: block })
        ]);

        const zlpPrice: BigNumber = new BigNumber(+zlpPriceInt).dividedBy(1e18);
        const zunamiTotalHoldings: BigNumber = new BigNumber(+zunamiTotalHoldingsInt).dividedBy(1e18);
        const zunamiTotalSupply: BigNumber = new BigNumber(+zunamiTotalSupplyInt).dividedBy(1e18);

        console.log(`Block: ${block}`);
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
