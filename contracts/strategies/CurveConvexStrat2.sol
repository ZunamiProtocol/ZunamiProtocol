//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePool.sol';
import '../interfaces/ICurvePool2.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexBooster.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IConvexRewards.sol';
import '../interfaces/IZunami.sol';
import './CurveConvexExtraStratBase.sol';

contract CurveConvexStrat2 is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    ICurvePool2 public pool;
    ICurvePool public pool3;
    IERC20Metadata public pool3LP;

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
        pool = ICurvePool2(poolAddr);

        pool3 = ICurvePool(Constants.CRV_3POOL_ADDRESS);
        pool3LP = IERC20Metadata(Constants.CRV_3POOL_LP_ADDRESS);
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
        uint256 _amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            _amountsTotal += amounts[i] * decimalsMultiplierS[i];
        }
        uint256 amountsMin = (_amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool3.get_virtual_price();
        uint256 depositedLp = pool3.calc_token_amount(amounts, true);
        if ((depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin) {
            for (uint256 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool3), amounts[i]);
            }
            pool3.add_liquidity(amounts, 0);
            uint256[2] memory amounts2;
            amounts2[1] = pool3LP.balanceOf(address(this));
            pool3LP.safeIncreaseAllowance(address(pool), amounts2[1]);
            uint256 poolLPs = ICurvePool2(address(pool)).add_liquidity(amounts2, 0);
            poolLP.safeApprove(address(booster), poolLPs);
            booster.depositAll(cvxPoolPID, true);
            return ((poolLPs * pool.get_virtual_price()) / CURVE_PRICE_DENOMINATOR);
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
        uint256[2] memory minAmounts2;
        minAmounts2[1] = pool3.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) /
            strategyLpShares;

        if (depositedShare < ICurvePool2(address(pool)).calc_token_amount(minAmounts2, false)) {
            return false;
        }

        sellRewardsAndExtraToken(depositedShare);

        (
            uint256[] memory userBalances,
            uint256[] memory prevBalances
        ) = getCurrentStratAndUserBalances(lpShares, strategyLpShares);

        uint256 prevCrv3Balance = pool3LP.balanceOf(address(this));
        ICurvePool2(address(pool)).remove_liquidity(depositedShare, minAmounts2);

        sellToken();

        uint256 crv3LiqAmount = pool3LP.balanceOf(address(this)) - prevCrv3Balance;
        pool3.remove_liquidity(crv3LiqAmount, minAmounts);

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
            ICurvePool2(address(pool)).exchange_underlying(0, 3, sellBal, 0);
        }
    }

    function withdrawAllSpecific() internal override {
        uint256[2] memory minAmounts2;
        uint256[3] memory minAmounts;
        ICurvePool2(address(pool)).remove_liquidity(poolLP.balanceOf(address(this)), minAmounts2);
        sellToken();
        pool3.remove_liquidity(pool3LP.balanceOf(address(this)), minAmounts);
    }
}
