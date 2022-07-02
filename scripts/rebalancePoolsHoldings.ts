import { ethers } from 'hardhat';
import { BigNumber } from 'bignumber.js';

interface IPoolValueInfo {
    address: string;
    holdings: string;
    tokens: string;
    price: string;
    additionalHoldings: string;
    rebalancedPrice: string;
}

async function main() {
    const zunamiAddr = '0x2ffCC661011beC72e1A9524E12060983E74D14ce';
    const zunamiAbi = [
        'function poolCount() external view returns (uint256)',
        'function lpPrice() external view returns (uint256)',
        'function poolInfo(uint256 pid) external view returns (tuple(address, uint256, uint256))',
    ];
    const strategyAbi = ['function totalHoldings() public view returns (uint256)'];
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_API_KEY);
    const zunami = new ethers.Contract(zunamiAddr, zunamiAbi, provider);

    const poolCount = +(await zunami.poolCount());
    const poolIds = Array.from(Array(poolCount).keys());
    const poolInfos = await Promise.all(poolIds.map((id) => zunami.poolInfo(id)));

    const [zlpPriceInt, holdingsPoolsInt] = await Promise.all([
      zunami.lpPrice(),
      Promise.all(poolIds.map(async (id) => (new ethers.Contract(poolInfos[id][0], strategyAbi, provider)).totalHoldings()))
    ]);

    const zlpPrice: BigNumber = new BigNumber(+zlpPriceInt).dividedBy(1e18);
    const pools: IPoolValueInfo[] = [];

    for (let i = 0; i < poolCount; i++) {
        let poolZlpAmount = new BigNumber(+poolInfos[i][2]).dividedBy(1e18);
        let holdings = new BigNumber(+holdingsPoolsInt[i]).dividedBy(1e18);
        let stratAddr = poolInfos[i][0];
        stratAddr = stratAddr.substring(0,8) + '...' +  stratAddr.substring(stratAddr.length - 4)

        if (holdings.eq(0)) {
            pools.push({
                address: stratAddr,
                holdings: '0',
                tokens: '0',
                price: '0',
                additionalHoldings: '0',
                rebalancedPrice: '0',
            });
            continue;
        }

        let price = holdings
            .dividedBy(+poolZlpAmount);

        let deltaPrice = zlpPrice.minus(price);
        let additionalHoldings = holdings.dividedBy(price).times(deltaPrice);

        let rebalancedPrice = holdings.plus(additionalHoldings).dividedBy(+poolZlpAmount);

        pools.push({
            address: stratAddr,
            holdings: holdings.toString(),
            tokens: poolZlpAmount.toString(),
            price: price.toString(),
            additionalHoldings: additionalHoldings.toString(),
            rebalancedPrice: rebalancedPrice.toString(),
        });
    }

    console.log(`Zunami LP: ${zlpPrice.toString()}`);
    console.table(pools);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
