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

    function calcWithdrawOneCoin(
        uint256 userRatioOfCrvLps,
        uint128 tokenIndex
    ) external override view returns(uint256 tokenAmount) {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) /
            1e18;
        return pool.calc_withdraw_one_coin(removingCrvLps, int128(tokenIndex));
    }

    function calcCrvLps(
        WithdrawalType withdrawalType,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal view override returns(
        bool success,
        uint256 removingCrvLps,
        uint[] memory tokenAmountsDynamic
    ) {
        uint256 requiredCrvLPs = pool.calc_token_amount(tokenAmounts, false);
        removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) /
            1e18;
        success = removingCrvLps >= requiredCrvLPs;

        if(success && withdrawalType == WithdrawalType.OneCoin) {
            success = tokenAmounts[tokenIndex] <= pool.calc_withdraw_one_coin(removingCrvLps, int128(tokenIndex));
        }

        tokenAmountsDynamic = fromArr3(tokenAmounts);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        if(withdrawalType == WithdrawalType.Base) {
            pool.remove_liquidity(removingCrvLps, tokenAmounts, true);
        } else if(withdrawalType == WithdrawalType.OneCoin) {
            pool.remove_liquidity_one_coin(removingCrvLps, int128(tokenIndex), tokenAmounts[tokenIndex], true);
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
