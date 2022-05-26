//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStratBase.sol';
import '../interfaces/ICurvePool.sol';
import '../interfaces/ICurvePool2.sol';

import 'hardhat/console.sol';

contract D3CurveConvex is CurveConvexStratBase {
    using SafeERC20 for IERC20Metadata;

    ICurvePool pool3;
    IERC20Metadata pool3LP;
    ICurvePool2 fraxPool;
    IERC20Metadata fraxLP;
    ICurvePool d3Pool;
    IERC20Metadata d3PoolLP;

    constructor(Config memory config)
        CurveConvexStratBase(
            config,
            Constants.CRV_D3_ADDRESS,
            Constants.CVX_D3_REWARDS_ADDRESS,
            Constants.CVX_D3_PID
        )
    {
        pool3 = ICurvePool(Constants.CRV_3POOL_ADDRESS);
        pool3LP = IERC20Metadata(Constants.CRV_3POOL_LP_ADDRESS);
        fraxPool = ICurvePool2(Constants.CRV_FRAX_ADDRESS);
        fraxLP = IERC20Metadata(Constants.FRAX_ADDRESS);
        d3Pool = ICurvePool(Constants.CRV_D3_ADDRESS);
        d3PoolLP = IERC20Metadata(Constants.CRV_D3_LP_ADDRESS);
    }

    function checkDepositSuccessful(uint256[3] memory amounts)
        internal
        view
        override
        returns (bool)
    {
        uint256 amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            amountsTotal += amounts[i] * decimalsMultipliers[i];
        }

        uint256 deposited3Lp = pool3.calc_token_amount(amounts, true);
        uint256 depositedFraxLp = fraxPool.calc_token_amount([deposited3Lp, 0], true, false);
        uint256 fraxLpPrice = fraxPool.get_virtual_price();
        uint256 amountsMin = (depositedFraxLp * minDepositAmount) / DEPOSIT_DENOMINATOR;

        return (depositedFraxLp * fraxLpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[3] memory amounts) internal override returns (uint256 d3LPAmount) {
        for (uint256 i = 0; i < 3; i++) {
            _config.tokens[i].safeIncreaseAllowance(address(pool3), amounts[i]);
        }
        pool3.add_liquidity(amounts, 0);

        uint256 lp3Amounts = pool3LP.balanceOf(address(this));
        int128 sellCoinIndex = 1;
        int128 buyCoinIndex = 0;
        pool3LP.safeIncreaseAllowance(address(fraxPool), lp3Amounts);
        fraxPool.exchange(sellCoinIndex, buyCoinIndex, lp3Amounts, 0);

        uint256[3] memory fraxAmounts;
        uint256 fraxIndex = 0;
        fraxAmounts[fraxIndex] = fraxLP.balanceOf(address(this));
        fraxLP.safeIncreaseAllowance(address(d3Pool), fraxAmounts[fraxIndex]);
        d3Pool.add_liquidity(fraxAmounts, 0);

        d3LPAmount = d3PoolLP.balanceOf(address(this));

        d3PoolLP.safeApprove(address(_config.booster), d3LPAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return d3Pool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        public
        view
        override
        returns (uint256 tokenAmount)
    {
        uint256 d3poolLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        uint256 fraxLps = d3Pool.calc_withdraw_one_coin(d3poolLps, 0);
        uint256 pool3Lps = fraxPool.calc_withdraw_one_coin(fraxLps, 0);
        tokenAmount = pool3.calc_withdraw_one_coin(pool3Lps, int128(tokenIndex));
    }

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        public
        view
        override
        returns (uint256 sharesAmount)
    {
        uint256 pool3Lps = pool3.calc_token_amount(tokenAmounts, isDeposit);
        uint256 fraxLps = fraxPool.calc_token_amount([pool3Lps, 0], isDeposit);
        sharesAmount = d3Pool.calc_token_amount([fraxLps, 0, 0], isDeposit);
    }

    function calcCrvLps(
        WithdrawalType withdrawalType,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    )
        internal
        view
        override
        returns (
            bool success,
            uint256 removingCrvLps,
            uint256[] memory tokenAmountsDynamic
        )
    {
        removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        success = removingCrvLps >= calcSharesAmount(tokenAmounts, false);

        if (success && withdrawalType == WithdrawalType.OneCoin) {
            success = tokenAmounts[tokenIndex] <= calcWithdrawOneCoin(removingCrvLps, tokenIndex);
        }

        tokenAmountsDynamic = new uint256[](2);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        uint256 fraxBalanceBefore = fraxLP.balanceOf(address(this));
        d3Pool.remove_liquidity_one_coin(removingCrvLps, 0, 0);
        uint256 fraxLPAmount = fraxLP.balanceOf(address(this)) - fraxBalanceBefore;

        console.log('D3CurveConvex.sol:143: removingCrvLps = %s', removingCrvLps);
        console.log('D3CurveConvex.sol:144: fraxLPAmount = %s', fraxLPAmount);

        pool3LP.safeIncreaseAllowance(address(fraxPool), fraxLPAmount);

        uint256 pool3BalanceBefore = pool3LP.balanceOf(address(this));
        console.log('D3CurveConvex.sol:149: pool3BalanceBefore = %s', pool3BalanceBefore);
        int128 sellCoinIndex = 0;
        int128 buyCoinIndex = 1;
        fraxPool.exchange(sellCoinIndex, buyCoinIndex, fraxLPAmount, 0);

        /* uint256 prevCrv3Balance = pool3LP.balanceOf(address(this));

        uint256[2] memory minAmounts2;
        pool.remove_liquidity_one_coin(removingCrvLps, CURVE_3POOL_LP_TOKEN_ID_INT, 0);

        uint256 crv3LiqAmount = pool3LP.balanceOf(address(this)) - prevCrv3Balance;
        if (withdrawalType == WithdrawalType.Base) {
            pool3.remove_liquidity(crv3LiqAmount, tokenAmounts);
        } else if (withdrawalType == WithdrawalType.OneCoin) {
            pool3.remove_liquidity_one_coin(
                crv3LiqAmount,
                int128(tokenIndex),
                tokenAmounts[tokenIndex]
            );
        } */
    }
}
