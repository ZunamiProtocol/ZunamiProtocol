//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurveLandingPool.sol';
import './CurveConvexStratBase.sol';

contract CurveConvexStrat is Context, CurveConvexStratBase {
    using SafeERC20 for IERC20Metadata;

    ICurveLandingPool public pool;

    constructor(
        Config memory config,
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID
    ) CurveConvexStratBase(config, poolLPAddr, rewardsAddr, poolPID) {
        pool = ICurveLandingPool(poolAddr);
    }

   function checkDepositSuccessful(uint256[3] memory amounts) internal view override returns (bool) {
        uint256 _amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            _amountsTotal += amounts[i] * decimalsMultipliers[i];
        }
        uint256 amountsMin = (_amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts, true);

        return (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[3] memory amounts) internal override returns (uint256 poolLPs) {
        for (uint256 i = 0; i < 3; i++) {
            _config.tokens[i].safeIncreaseAllowance(address(pool), amounts[i]);
        }

        poolLPs = pool.add_liquidity(amounts, 0, true);

        poolLP.safeApprove(address(_config.booster), poolLPs);
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
        uint256 crvRequiredLPs = pool.calc_token_amount(tokenAmounts, false);
        depositedShare = (cvxRewards.balanceOf(address(this)) * lpShareUserRation) /
            1e18;
        success = depositedShare >= crvRequiredLPs;

        if(success && withdrawalType == WithdrawalType.OneCoin) {
            success = tokenAmounts[tokenIndex] <= pool.calc_withdraw_one_coin(depositedShare, int128(tokenIndex));
        }

        tokenAmountsDynamic = fromArr3(tokenAmounts);
    }

    function removeCurveDepositShares(
        uint256 depositedShare,
        uint[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        if(withdrawalType == WithdrawalType.Base) {
            pool.remove_liquidity(depositedShare, tokenAmounts, true);
        } else if(withdrawalType == WithdrawalType.Imbalance) {
            pool.remove_liquidity_imbalance(tokenAmounts, depositedShare, true);
        } else if(withdrawalType == WithdrawalType.OneCoin) {
            pool.remove_liquidity_one_coin(depositedShare, int128(tokenIndex), tokenAmounts[tokenIndex], true);
        }
    }

    /**
     * @dev can be called by Zunami contract.
     * This function need for moveFunds between strategys.
     */
    function withdrawAll() external virtual onlyZunami {
        cvxRewards.withdrawAllAndUnwrap(true);
        sellRewards();

        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[3] memory minAmounts;
        pool.remove_liquidity(lpBalance, minAmounts, true);

        transferZunamiAllTokens();
    }
}
