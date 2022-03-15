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

        pool.add_liquidity(amounts4, 0);
        poolLPs = poolLP.balanceOf(address(this));
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
//        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) /
//            1e18;
//        return pool.calc_withdraw_one_coin(removingCrvLps, int128(tokenIndex));
        revert('Not supported');
    }

    function calcSharesAmount(
        uint256[3] memory tokenAmounts,
        bool isDeposit
    ) external override view returns(uint256 sharesAmount) {
        uint256[4] memory tokenAmounts4;
        for (uint256 i = 0; i < 3; i++) {
            tokenAmounts4[i] = tokenAmounts[i];
        }
        return pool.calc_token_amount(tokenAmounts4, isDeposit);
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
        uint256[4] memory minAmounts4;
        for (uint256 i = 0; i < 3; i++) {
            minAmounts4[i] = tokenAmounts[i];
        }
        uint256 requiredCrvLPs = pool.calc_token_amount(minAmounts4, false);
        removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) /
        1e18;

        success = removingCrvLps >= requiredCrvLPs;

        if(success && withdrawalType == WithdrawalType.OneCoin) {
//            success = tokenAmounts[tokenIndex] <= pool.calc_withdraw_one_coin(removingCrvLps, int128(tokenIndex));
            revert('Not supported');
        }

        tokenAmountsDynamic = fromArr4(minAmounts4);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        if(withdrawalType == WithdrawalType.Base) {
            pool.remove_liquidity(removingCrvLps, toArr4(tokenAmountsDynamic));
        } else if(withdrawalType == WithdrawalType.OneCoin) {
//            pool.remove_liquidity_one_coin(removingCrvLps, int128(tokenIndex), tokenAmounts[tokenIndex]);
            revert('Not supported');
        }
    }

    /**
     * @dev sell base token on strategy can be called by anyone
     */
    function sellToken() public {
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
