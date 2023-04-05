// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import "../interfaces/IZunamiPoolController.sol";
import "../interfaces/IZunamiRebalancer.sol";

contract ZunamiRebalancer is IZunamiRebalancer{

    struct PriceInfo {
        uint256 pid;
        uint256 price;
        uint256 holdings;
    }

    IZunamiPoolController public immutable zunami;

    modifier onlyZunami() {
        require(msg.sender == address(zunami), 'must be called by Zunami contract');
        _;
    }

    constructor(address zunamiAddress) {
        zunami = IZunamiPoolController(zunamiAddress);
    }

    function rebalance() external onlyZunami {
        //calc strategy lp prices
        uint256 totalHoldings = 0;
        uint256 poolCount = zunami.poolCount();
        PriceInfo[] memory prices = new PriceInfo[](poolCount);
        for (uint256 i = 0; i < poolCount; i++) {
            IZunamiPoolController.PoolInfo memory poolInfo = zunami.poolInfo(i);
            if (poolInfo.lpShares == 0 || !poolInfo.enabled) continue;
            uint256 holdings = poolInfo.strategy.totalHoldings();
            prices[i] = PriceInfo(i, zunami.calcTokenPrice(holdings, poolInfo.lpShares), holdings);
            totalHoldings += holdings;
        }

        //cache protocol lp price
        uint256 commonPrice = zunami.calcTokenPrice(totalHoldings, zunami.totalSupply());

        //descendant sort of prices
        PriceInfo[] memory sortedPrices = sortPrices(prices);

        uint256 boundary = sortedPrices.length - 1;
        for (uint256 i = 0; i <= boundary; i++) {
            PriceInfo memory lowerPrice = sortedPrices[i];
            if (lowerPrice.price == 0) continue;
            if (lowerPrice.price >= commonPrice) break;

            IZunamiPoolController.PoolInfo memory lowerPool = zunami.poolInfo(lowerPrice.pid);
            uint256 lowerTokenDiff = calcTokenDiff(
                lowerPool.lpShares,
                commonPrice,
                lowerPrice.holdings
            );
            zunami.decreasePoolShares(lowerPrice.pid, lowerTokenDiff);

            for (uint256 j = boundary; j >= i + 1; j--) {
                PriceInfo memory higherPrice = sortedPrices[j];
                if (higherPrice.price == 0) continue;
                if (higherPrice.price <= commonPrice) break;

                IZunamiPoolController.PoolInfo memory higherPool = zunami.poolInfo(higherPrice.pid);
                uint256 higherTokenDiff = calcTokenDiff(
                    higherPool.lpShares,
                    commonPrice,
                    higherPrice.holdings
                );
                if (higherTokenDiff >= lowerTokenDiff) {
                    zunami.increasePoolShares(higherPrice.pid, lowerTokenDiff);
                    lowerTokenDiff = 0;
                    break;
                }

                zunami.increasePoolShares(higherPrice.pid, higherTokenDiff);
                lowerTokenDiff -= higherTokenDiff;
                boundary -= 1;
            }

            // give back unused lps
            if (lowerTokenDiff > 0) {
                zunami.increasePoolShares(lowerPrice.pid, lowerTokenDiff);
            }
        }
    }

    function calcTokenDiff(
        uint256 shares,
        uint256 price,
        uint256 value
    ) internal pure returns (uint256) {
        uint256 balancedShares = (value * 1e18) / price;
        return shares > balancedShares ? shares - balancedShares : balancedShares - shares;
    }

    function sortPrices(PriceInfo[] memory arr) private pure returns (PriceInfo[] memory) {
        uint256 l = arr.length;
        for (uint256 i = 0; i < l; i++) {
            for (uint256 j = i + 1; j < l; j++) {
                if (arr[i].price > arr[j].price) (arr[i], arr[j]) = (arr[j], arr[i]);
            }
        }
        return arr;
    }
}
