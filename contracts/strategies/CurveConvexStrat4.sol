//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePool4.sol';
import './CurveConvexExtraStratBase.sol';

contract CurveConvexStrat4 is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;

    ICurvePool4 public pool;

    constructor(
        Config memory config,
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexExtraStratBase(
            config,
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

   function checkDepositSuccessful(uint256[3] memory amounts) internal view override returns (bool) {
        // check decimal amounts
        uint256 decAmounts = 0;
        uint256[4] memory amounts4;
        for (uint256 i = 0; i < 3; i++) {
            decAmounts += amounts[i] * decimalsMultipliers[i];
            amounts4[i] = amounts[i];
        }

        uint256 amountsMin = (decAmounts * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts4, true);

        return (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[3] memory amounts) internal override returns (uint256 poolLPs) {
        uint256[4] memory amounts4;
        for (uint256 i = 0; i < 3; i++) {
            amounts4[i] = amounts[i];
            _config.tokens[i].safeIncreaseAllowance(address(pool), amounts[i]);
        }
        poolLPs = pool.add_liquidity(amounts4, 0);

        poolLP.safeApprove(address(_config.booster), poolLP.balanceOf(address(this)));
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return pool.get_virtual_price();
    }

    function calcCurveDepositShares(
        WithdrawalType withdrawalType,
        uint256 lpShareUserRation, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal view override returns(
        bool success,
        uint256 depositedShare,
        uint[] memory tokenAmountsDynamic
    ) {
        uint256[4] memory minAmounts4;
        for (uint256 i = 0; i < 3; i++) {
            minAmounts4[i] = tokenAmounts[i];
        }
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts4, false);
        depositedShare = (cvxRewards.balanceOf(address(this)) * lpShareUserRation) /
        1e18;

        success = depositedShare >= crvRequiredLPs;

        if(success && withdrawalType == WithdrawalType.OneCoin) {
            success = tokenAmounts[tokenIndex] <= pool.calc_withdraw_one_coin(depositedShare, int128(tokenIndex));
        }

        tokenAmountsDynamic = fromArr4(minAmounts4);
    }

    function removeCurveDepositShares(
        uint256 depositedShare,
        uint[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        if(withdrawalType == WithdrawalType.Base) {
            pool.remove_liquidity(depositedShare, toArr4(tokenAmountsDynamic));
        } else if(withdrawalType == WithdrawalType.Imbalance) {
            pool.remove_liquidity_imbalance(toArr4(tokenAmountsDynamic), depositedShare);
        } else if(withdrawalType == WithdrawalType.OneCoin) {
            pool.remove_liquidity_one_coin(depositedShare, int128(tokenIndex), tokenAmounts[tokenIndex]);
        }
    }

    /**
     * @dev sell base token on strategy can be called by anyone
     */
    function sellToken() public virtual {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeApprove(address(pool), sellBal);
            pool.exchange_underlying(3, 2, sellBal, 0);
        }
    }

    function withdrawAllSpecific() internal override {
        uint256[4] memory minAmounts;
        pool.remove_liquidity(poolLP.balanceOf(address(this)), minAmounts);
        sellToken();
    }
}
