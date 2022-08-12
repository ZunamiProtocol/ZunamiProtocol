//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../interfaces/ICurvePool2.sol';
import './CurveConvexExtraStratBase.sol';
import '../utils/Constants.sol';

contract CurveConvexFraxBasePool is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;

    int128 constant CURVE_POOL_USDC_ID = 1;
    uint256 constant USDC_ID = 1;
    uint256 constant CRV_FRAX_ID = 1;

    ICurvePool2 public fraxUSDCPool;
    IERC20Metadata public crvFraxLp;
    ICurvePool2 public fraxBasePool;
    IERC20Metadata public fraxBPLp;

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
            extraTokenAddr,
            [Constants.WETH_ADDRESS, Constants.USDC_ADDRESS]
        )
    {
        fraxUSDCPool = ICurvePool2(Constants.FRAX_USDC_ADDRESS);
        crvFraxLp = IERC20Metadata(Constants.FRAX_USDC_LP_ADDRESS);

        fraxBasePool = ICurvePool2(poolAddr);
        fraxBPLp = IERC20Metadata(poolLPAddr);
    }

    function checkDepositSuccessful(uint256[3] memory tokenAmounts)
        internal
        view
        override
        returns (bool isValidDepositAmount)
    {
        uint256 amountsTotal;
        for (uint256 i = 0; i < tokenAmounts.length; i++) {
            amountsTotal += tokenAmounts[i] * decimalsMultipliers[i];
        }

        uint256 amountsMin = (amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;

        uint256[2] memory amounts;
        amounts[USDC_ID] = tokenAmounts[0] / 1e12 + tokenAmounts[1] + tokenAmounts[2];

        uint256 lpPrice = fraxUSDCPool.get_virtual_price();
        uint256 depositedLp = fraxUSDCPool.calc_token_amount(amounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[3] memory tokenAmounts)
        internal
        override
        returns (uint256 fraxBPLpAmount)
    {
        uint256 usdcBalanceBefore = _config.tokens[USDC_ID].balanceOf(address(this));
        if (tokenAmounts[0] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.DAI_ADDRESS));
        }

        if (tokenAmounts[2] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.USDT_ADDRESS));
        }

        uint256 usdcAmount = _config.tokens[USDC_ID].balanceOf(address(this)) -
            usdcBalanceBefore +
            tokenAmounts[USDC_ID];

        uint256[2] memory amounts;
        amounts[USDC_ID] = usdcAmount;
        _config.tokens[USDC_ID].safeIncreaseAllowance(address(fraxUSDCPool), usdcAmount);
        uint256 crvFraxLpAmount = fraxUSDCPool.add_liquidity(amounts, 0);

        crvFraxLp.safeIncreaseAllowance(address(fraxBasePool), crvFraxLpAmount);
        amounts[CRV_FRAX_ID] = crvFraxLpAmount;
        fraxBPLpAmount = fraxBasePool.add_liquidity(amounts, 0);

        fraxBPLp.safeIncreaseAllowance(address(_config.booster), fraxBPLpAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256 curveVirtualPrice) {
        curveVirtualPrice = fraxBasePool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        external
        view
        override
        returns (uint256 tokenAmount)
    {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        uint256 crvFraxLpAmount = fraxBasePool.calc_withdraw_one_coin(
            removingCrvLps,
            CURVE_POOL_USDC_ID
        );

        tokenAmount = fraxUSDCPool.calc_withdraw_one_coin(crvFraxLpAmount, CURVE_POOL_USDC_ID);
    }

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        external
        view
        override
        returns (uint256 sharesAmount)
    {
        uint256[2] memory amounts;
        amounts[USDC_ID] = tokenAmounts[0] / 1e12 + tokenAmounts[1] + tokenAmounts[2];
        amounts[USDC_ID] = fraxUSDCPool.calc_token_amount(amounts, isDeposit);
        sharesAmount = fraxBasePool.calc_token_amount(amounts, isDeposit);
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
            uint256 fraxBPLpAmount,
            uint256[] memory tokenAmountsDynamic
        )
    {
        uint256[2] memory minAmounts;
        minAmounts[USDC_ID] = tokenAmounts[0] / 1e12 + tokenAmounts[1] + tokenAmounts[2];
        minAmounts[USDC_ID] = fraxUSDCPool.calc_token_amount(minAmounts, false);

        fraxBPLpAmount = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;

        success = fraxBPLpAmount >= fraxBasePool.calc_token_amount(minAmounts, false);

        if (success && withdrawalType == WithdrawalType.OneCoin) {
            uint256 crvFraxLpAmount = fraxBasePool.calc_withdraw_one_coin(
                fraxBPLpAmount,
                CURVE_POOL_USDC_ID
            );
            success =
                tokenAmounts[USDC_ID] <=
                fraxUSDCPool.calc_withdraw_one_coin(crvFraxLpAmount, CURVE_POOL_USDC_ID);
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
        uint256 crvFraxLpAmount = fraxBasePool.remove_liquidity_one_coin(
            removingCrvLps,
            CURVE_POOL_USDC_ID,
            0
        );

        if (withdrawalType == WithdrawalType.OneCoin) {
            fraxUSDCPool.remove_liquidity_one_coin(
                crvFraxLpAmount,
                CURVE_POOL_USDC_ID,
                tokenAmounts[USDC_ID]
            );
        }
    }

    function sellToken() public {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeApprove(address(fraxBasePool), sellBal);
            fraxBasePool.exchange_underlying(0, 1, sellBal, 0);
        }
    }

    function withdrawAllSpecific() internal override {
        uint256[2] memory minAmounts;
        fraxBasePool.remove_liquidity(fraxBPLp.balanceOf(address(this)), minAmounts);
        sellToken();
        fraxUSDCPool.remove_liquidity(crvFraxLp.balanceOf(address(this)), minAmounts);
    }

    function swapTokenToUSDC(IERC20Metadata token) internal {
        require(address(token) != address(0), 'Wrong address');

        address[] memory path = new address[](3);
        path[0] = address(token);
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDC_ADDRESS;

        uint256 balance = token.balanceOf(address(this));

        if (balance > 0) {
            token.safeApprove(address(_config.router), balance);
            _config.router.swapExactTokensForTokens(
                balance,
                0,
                path,
                address(this),
                block.timestamp + Constants.TRADE_DEADLINE
            );
        }
    }
}
