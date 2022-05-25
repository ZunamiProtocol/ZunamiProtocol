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

    uint8 public constant CURVE_FRAX_LP_TOKEN_ID = 0;

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
        fraxLP = IERC20Metadata(Constants.CRV_FRAX_LP_ADDRESS);
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

    function depositPool(uint256[3] memory amounts) internal override returns (uint256 poolLPs) {
        for (uint256 i = 0; i < 3; i++) {
            _config.tokens[i].safeIncreaseAllowance(address(pool3), amounts[i]);
        }
        pool3.add_liquidity(amounts, 0);

        uint256[2] memory lp3Amounts;
        uint8 lp3Index = 1;
        lp3Amounts[lp3Index] = pool3LP.balanceOf(address(this));
        pool3LP.safeIncreaseAllowance(address(fraxPool), lp3Amounts[lp3Index]);
        fraxPool.add_liquidity(lp3Amounts, 0);

        uint256[3] memory fraxAmounts;
        uint8 fraxIndex = 0;
        fraxAmounts[fraxIndex] = fraxLP.balanceOf(address(this));
        fraxLP.safeIncreaseAllowance(address(d3Pool), fraxAmounts[fraxIndex]);
        d3Pool.add_liquidity(fraxAmounts, 0);

        poolLPs = d3PoolLP.balanceOf(address(this));

        // poolLP.safeApprove(address(_config.booster), poolLPs);
        // _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return d3Pool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 sharesAmount, uint128 tokenIndex)
        external
        view
        override
        returns (uint256 tokenAmount)
    {}

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        external
        view
        override
        returns (uint256 sharesAmount)
    {}

    function calcCrvLps(
        WithdrawalType withdrawalType,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    )
        internal
        override
        returns (
            bool success,
            uint256 removingCrvLps,
            uint256[] memory tokenAmountsDynamic
        )
    {}

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256[] memory tokenAmountsDynamic,
        WithdrawalType withdrawalType,
        uint256[3] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {}
}
