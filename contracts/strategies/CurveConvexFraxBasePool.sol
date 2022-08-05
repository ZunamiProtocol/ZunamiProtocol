//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './CurveConvexExtraStratBase.sol';
import '../utils/Constants.sol';

import '../interfaces/ICurvePool2.sol';

import 'hardhat/console.sol';

abstract contract CurveConvexFraxBasePool is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;

    ICurvePool2 public pool;
    IERC20Metadata public lpToken;

    int128 CURVE_POOL_USDC_ID = 1;
    uint256 USDC_ID = 1;

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
    {}

    function checkDepositSuccessful(uint256[3] memory tokenAmounts)
        internal
        view
        override
        returns (bool isValidDepositAmount)
    {
        uint256 amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            amountsTotal += tokenAmounts[i] * decimalsMultipliers[i];
        }

        uint256 amountsMin = (amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();

        uint256[2] memory amounts;
        amounts[USDC_ID] = tokenAmounts[USDC_ID];
        uint256 depositedLp = pool.calc_token_amount(amounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[3] memory tokenAmounts)
        internal
        override
        returns (uint256 lpTokenAmount)
    {
        if (tokenAmounts[0] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.DAI_ADDRESS));
        }

        if (tokenAmounts[2] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.USDT_ADDRESS));
        }

        _config.tokens[USDC_ID].safeIncreaseAllowance(address(pool), tokenAmounts[USDC_ID]);

        uint256[2] memory amounts;
        amounts[USDC_ID] = tokenAmounts[USDC_ID];

        lpTokenAmount = pool.add_liquidity(amounts, 0);
        poolLP.safeApprove(address(_config.booster), lpTokenAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256 curveVirtualPrice) {
        console.log('Alexey 1');
        curveVirtualPrice = pool.get_virtual_price();
        console.log('Alexey 2');
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        external
        view
        override
        returns (uint256 tokenAmount)
    {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        tokenAmount = pool.calc_withdraw_one_coin(removingCrvLps, CURVE_POOL_USDC_ID);
    }

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        external
        view
        override
        returns (uint256 sharesAmount)
    {
        uint256[2] memory amounts;
        amounts[USDC_ID] = tokenAmounts[USDC_ID];
        sharesAmount = pool.calc_token_amount(amounts, isDeposit);
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

        uint256[2] memory amount;
        amount[USDC_ID] = tokenAmounts[USDC_ID];

        success = removingCrvLps >= pool.calc_token_amount(amount, false);

        if (success && withdrawalType == WithdrawalType.OneCoin) {
            success =
                tokenAmounts[USDC_ID] <=
                pool.calc_withdraw_one_coin(removingCrvLps, CURVE_POOL_USDC_ID);
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
        pool.remove_liquidity_one_coin(removingCrvLps, CURVE_POOL_USDC_ID, tokenAmounts[USDC_ID]);
    }

    function sellToken() public {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeApprove(address(pool), sellBal);
            pool.exchange_underlying(0, 3, sellBal, 0);
        }
    }

    function withdrawAllSpecific() internal override {
        uint256[2] memory minAmounts;
        sellToken();
        pool.remove_liquidity(lpToken.balanceOf(address(this)), minAmounts);
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
