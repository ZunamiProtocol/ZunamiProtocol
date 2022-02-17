//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePool4.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexBooster.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IConvexRewards.sol';
import '../interfaces/IZunami.sol';
import './CurveConvexExtraStratBase.sol';

contract CurveConvexStrat4 is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    ICurvePool4 public pool;

    constructor(
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexExtraStratBase(
            poolLPAddr,
            rewardsAddr,
            poolPID,
            tokenAddr,
            extraRewardsAddr,
            extraTokenAddr
        )
    {
        pool = ICurvePool4(poolAddr);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return pool.get_virtual_price();
    }

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amounts - amounts in stablecoins that user deposit
     */
    function deposit(uint256[3] memory amounts) external override onlyZunami returns (uint256) {
        // check decimal amounts
        uint256 decAmounts = 0;
        uint256[4] memory amounts4;
        for (uint256 i = 0; i < 3; i++) {
            decAmounts += amounts[i] * decimalsMultiplierS[i];
            amounts4[i] = amounts[i];
        }

        uint256 amountsMin = (decAmounts * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = ICurvePool4(address(pool)).calc_token_amount(amounts4, true);

        if ((depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin) {
            for (uint256 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool), amounts[i]);
            }
            uint256 depositedAmount = ICurvePool4(address(pool)).calc_token_amount(amounts4, true);
            ICurvePool4(address(pool)).add_liquidity(amounts4, 0);
            poolLP.safeApprove(address(booster), poolLP.balanceOf(address(this)));
            booster.depositAll(cvxPoolPID, true);
            return ((depositedAmount * pool.get_virtual_price()) / CURVE_PRICE_DENOMINATOR);
        } else {
            return (0);
        }
    }

    /**
     * @dev Returns true if withdraw success and false if fail.
     * Withdraw failed when user depositedShare < crvRequiredLPs (wrong minAmounts)
     * @return Returns true if withdraw success and false if fail.
     * @param withdrawer - address of user that deposit funds
     * @param lpShares - amount of ZLP for withdraw
     * @param minAmounts -  array of amounts stablecoins that user want minimum receive
     */
    function withdraw(
        address withdrawer,
        uint256 lpShares,
        uint256 strategyLpShares,
        uint256[3] memory minAmounts
    ) external override onlyZunami returns (bool) {
        uint256[4] memory minAmounts4;
        for (uint256 i = 0; i < 3; i++) {
            minAmounts4[i] = minAmounts[i];
        }
        uint256 crvRequiredLPs = ICurvePool4(address(pool)).calc_token_amount(minAmounts4, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) /
            strategyLpShares;

        if (depositedShare < crvRequiredLPs) {
            return false;
        }

        sellRewardsAndExtraToken(depositedShare);

        (
            uint256[] memory userBalances,
            uint256[] memory prevBalances
        ) = getCurrentStratAndUserBalances(lpShares, strategyLpShares);

        ICurvePool4(address(pool)).remove_liquidity(depositedShare, minAmounts4);

        sellToken();
        transferUserAllTokens(withdrawer, userBalances, prevBalances);

        return true;
    }

    /**
     * @dev sell base token on strategy can be called by anyone
     */
    function sellToken() public virtual {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeApprove(address(pool), sellBal);
            ICurvePool4(address(pool)).exchange_underlying(3, 2, sellBal, 0);
        }
    }

    function withdrawAllSpecific() internal override {
        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[4] memory minAmounts;
        ICurvePool4(address(pool)).remove_liquidity(lpBalance, minAmounts);
        sellToken();
    }
}
