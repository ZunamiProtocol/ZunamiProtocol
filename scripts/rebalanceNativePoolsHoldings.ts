import { ethers } from 'hardhat';
import { BigNumber } from 'bignumber.js';

interface IPoolValueInfo {
    address: string;
    holdings: string;
    percent: string;
    tokens: string;
    price: string;
    additionalHoldings: string;
    rebalancedPrice: string;
}

async function main() {
    const zunamiAddr = '0x9dE83985047ab3582668320A784F6b9736c6EEa7'; // prod
    const zunamiAbi = [
        'function poolCount() external view returns (uint256)',
        'function lpPrice() external view returns (uint256)',
        'function totalHoldings() external view returns (uint256)',
        'function poolInfo(uint256 pid) external view returns (tuple(address, uint256, uint256))',
        'function defaultDepositPid() external view returns (uint256)',
        'function defaultWithdrawPid() external view returns (uint256)',
    ];
    const strategyAbi = ['function totalHoldings() public view returns (uint256)'];
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_NODE_API_KEY);
    const zunami = new ethers.Contract(zunamiAddr, zunamiAbi, provider);

    const poolCount = +(await zunami.poolCount());
    const poolIds = Array.from(Array(poolCount).keys());
    const poolInfos = await Promise.all(poolIds.map((id) => zunami.poolInfo(id)));

    const [zlpPriceInt, zunamiTotalHoldingsInt, defaultDepositPid, defaultWithdrawPid, holdingsPoolsInt] = await Promise.all([
      zunami.lpPrice(),
      zunami.totalHoldings(),
      zunami.defaultDepositPid(),
      zunami.defaultWithdrawPid(),
      Promise.all(poolIds.map(async (id) => (new ethers.Contract(poolInfos[id][0], strategyAbi, provider)).totalHoldings()))
    ]);

    const zlpPriceCurrent: BigNumber = new BigNumber(+zlpPriceInt).dividedBy(1e18);
    const zlpPrice: BigNumber = zlpPriceCurrent; //new BigNumber(1.11679926379888973558);

    const zunamiTotalHoldings: BigNumber = new BigNumber(+zunamiTotalHoldingsInt).dividedBy(1e18);
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
                percent: '0',
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

        let currentPoolPercent = holdings.dividedBy(zunamiTotalHoldings).multipliedBy(100);

        pools.push({
            address: stratAddr,
            holdings: holdings.toString(),
            percent: currentPoolPercent.toString() + "%",
            tokens: poolZlpAmount.toString(),
            price: price.toString(),
            additionalHoldings: additionalHoldings.precision(12).toString(),
            rebalancedPrice: rebalancedPrice.precision(6).toString(),
        });
    }

    console.log(`Zunami LP: ${zlpPrice.toString()}`);
    console.log(`Zunami LP (current): ${zlpPriceCurrent.toString()}`);
    console.log(`Zunami Total Holdings: ${zunamiTotalHoldings.toString()}`);
    console.log(`Zunami Deposit PID: ${defaultDepositPid.toString()}`);
    console.log(`Zunami Withdraw PID: ${defaultWithdrawPid.toString()}`);
    console.table(pools);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
