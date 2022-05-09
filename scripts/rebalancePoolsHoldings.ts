import { ethers } from 'hardhat';
import { BigNumber } from 'bignumber.js';

interface IPoolInfo {
    holdings: string;
    tokens: string;
    price: string;
    additionalHoldings: string;
}

async function main() {
    const zunamiAddr = '0x2ffCC661011beC72e1A9524E12060983E74D14ce';
    const zunamiAbi = [
        'function poolCount() external view returns (uint256)',
        'function lpPrice() external view returns (uint256)',
        'function poolInfo(uint256 pid) external view returns (tuple(address, uint256, uint256))',
    ];
    const strategyAbi = ['function totalHoldings() public view returns (uint256)'];
    const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_API_KEY);
    const zunami = new ethers.Contract(zunamiAddr, zunamiAbi, provider);

    const poolCount = await zunami.poolCount();
    const zlpPrice: BigNumber = new BigNumber(+(await zunami.lpPrice()));
    const pools: IPoolInfo[] = [];

    for (let i = 0; i < poolCount; i++) {
        let [addr, , tokens] = await zunami.poolInfo(i);
        let strategy = new ethers.Contract(addr, strategyAbi, provider);
        let holdings = new BigNumber(+(await strategy.totalHoldings()));

        if (holdings.eq(0)) {
            pools.push({
                holdings: '0',
                tokens: '0',
                price: '0',
                additionalHoldings: '0',
            });
            continue;
        }

        let price = holdings
            .dividedBy(+tokens)
            .times(1e18)
            .integerValue();

        let deltaPrice = zlpPrice.minus(price);
        let additionalHoldings = holdings.dividedBy(price).times(deltaPrice).dividedBy(1e18);

        pools.push({
            holdings: holdings.toString(),
            tokens: tokens.toString(),
            price: price.toString(),
            additionalHoldings: additionalHoldings.toString(),
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
