//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../interfaces/ICurvePool2.sol';
import '../CurveConvexExtraStratBase.sol';
import "../../../../../interfaces/IStableConverter.sol";

abstract contract FraxCurveConvexStratBase is CurveConvexExtraStratBase {
    using SafeERC20 for IERC20Metadata;

    uint256 constant FRAX_USDC_POOL_USDC_ID = 1;
    int128 constant FRAX_USDC_POOL_USDC_ID_INT = 1;
    uint256 constant CRVFRAX_TOKEN_POOL_CRVFRAX_ID = 1;
    int128 constant CRVFRAX_TOKEN_POOL_CRVFRAX_ID_INT = 1;

    // fraxUsdcPool = FRAX + USDC => crvFrax
    ICurvePool2 public fraxUsdcPool;
    IERC20Metadata public fraxUsdcPoolLp; // crvFrax
    // crvFraxTokenPool = crvFrax + Token
    ICurvePool2 public crvFraxTokenPool;
    IERC20Metadata public crvFraxTokenPoolLp;

    IStableConverter public stableConverter;

    event SetStableConverter(address stableConverter);

    constructor(
        Config memory config,
        address fraxUsdcPoolAddr,
        address fraxUsdcPoolLpAddr,
        address crvFraxTokenPoolAddr,
        address crvFraxTokenPoolLpAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexExtraStratBase(
            config,
            crvFraxTokenPoolLpAddr,
            rewardsAddr,
            poolPID,
            tokenAddr,
            extraRewardsAddr,
            extraTokenAddr
        )
    {
        fraxUsdcPool = ICurvePool2(fraxUsdcPoolAddr);
        fraxUsdcPoolLp = IERC20Metadata(fraxUsdcPoolLpAddr);

        crvFraxTokenPool = ICurvePool2(crvFraxTokenPoolAddr);
        crvFraxTokenPoolLp = IERC20Metadata(crvFraxTokenPoolLpAddr);

        feeTokenId = ZUNAMI_USDC_TOKEN_ID;
    }

    function setStableConverter(address stableConverterAddr) external onlyOwner {
        stableConverter = IStableConverter(stableConverterAddr);
        emit SetStableConverter(stableConverterAddr);
    }

    function checkDepositSuccessful(uint256[POOL_ASSETS] memory tokenAmounts)
        internal
        view
        override
        returns (bool isValidDepositAmount)
    {
        uint256 amountsTotal;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            amountsTotal += tokenAmounts[i] * decimalsMultipliers[i];
        }

        uint256 amountsMin = (amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;

        uint256[2] memory amounts;
        amounts[FRAX_USDC_POOL_USDC_ID] = amountsTotal / 1e12;

        uint256 lpPrice = fraxUsdcPool.get_virtual_price();
        uint256 depositedLp = fraxUsdcPool.calc_token_amount(amounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[POOL_ASSETS] memory tokenAmounts)
        internal
        override
        returns (uint256 cvxDepositLpAmount)
    {
        uint256 usdcBalanceBefore = _config.tokens[ZUNAMI_USDC_TOKEN_ID].balanceOf(address(this));
        if (tokenAmounts[ZUNAMI_DAI_TOKEN_ID] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.DAI_ADDRESS));
        }

        if (tokenAmounts[ZUNAMI_USDT_TOKEN_ID] > 0) {
            swapTokenToUSDC(IERC20Metadata(Constants.USDT_ADDRESS));
        }

        uint256 usdcAmount = _config.tokens[ZUNAMI_USDC_TOKEN_ID].balanceOf(address(this)) -
            usdcBalanceBefore +
            tokenAmounts[ZUNAMI_USDC_TOKEN_ID];

        uint256[2] memory amounts;
        amounts[FRAX_USDC_POOL_USDC_ID] = usdcAmount;
        _config.tokens[ZUNAMI_USDC_TOKEN_ID].safeIncreaseAllowance(
            address(fraxUsdcPool),
            usdcAmount
        );
        uint256 crvFraxAmount = fraxUsdcPool.add_liquidity(amounts, 0);

        fraxUsdcPoolLp.safeIncreaseAllowance(address(crvFraxTokenPool), crvFraxAmount);
        amounts[CRVFRAX_TOKEN_POOL_CRVFRAX_ID] = crvFraxAmount;
        cvxDepositLpAmount = crvFraxTokenPool.add_liquidity(amounts, 0);

        crvFraxTokenPoolLp.safeIncreaseAllowance(address(_config.booster), cvxDepositLpAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return crvFraxTokenPool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        external
        view
        override
        returns (uint256)
    {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        uint256 crvFraxAmount = crvFraxTokenPool.calc_withdraw_one_coin(
            removingCrvLps,
            CRVFRAX_TOKEN_POOL_CRVFRAX_ID_INT
        );

        uint256 usdcAmount = fraxUsdcPool.calc_withdraw_one_coin(
            crvFraxAmount,
            FRAX_USDC_POOL_USDC_ID_INT
        );

        if (tokenIndex == ZUNAMI_USDC_TOKEN_ID) return usdcAmount;
        return
            stableConverter.valuate(
                address(_config.tokens[ZUNAMI_USDC_TOKEN_ID]),
                address(_config.tokens[tokenIndex]),
                usdcAmount
            );
    }

    function calcSharesAmount(uint256[POOL_ASSETS] memory tokenAmounts, bool isDeposit)
        external
        view
        override
        returns (uint256)
    {
        uint256[2] memory amounts = convertZunamiTokensToFraxUsdcs(tokenAmounts, isDeposit);
        return crvFraxTokenPool.calc_token_amount(amounts, isDeposit);
    }

    function convertZunamiTokensToFraxUsdcs(uint256[POOL_ASSETS] memory tokenAmounts, bool isDeposit)
        internal
        view
        returns (uint256[2] memory amounts)
    {
        amounts[FRAX_USDC_POOL_USDC_ID] =
            tokenAmounts[0] /
            1e12 +
            tokenAmounts[1] +
            tokenAmounts[2];
        amounts[CRVFRAX_TOKEN_POOL_CRVFRAX_ID] = fraxUsdcPool.calc_token_amount(amounts, isDeposit);
    }

    function calcCrvLps(
        WithdrawalType,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[POOL_ASSETS] memory tokenAmounts,
        uint128
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

        uint256[2] memory minAmounts = convertZunamiTokensToFraxUsdcs(tokenAmounts, false);
        success = removingCrvLps >= crvFraxTokenPool.calc_token_amount(minAmounts, false);

        tokenAmountsDynamic = new uint256[](2);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256[] memory,
        WithdrawalType withdrawalType,
        uint256[POOL_ASSETS] memory tokenAmounts,
        uint128 tokenIndex
    ) internal override {
        removeCrvLpsInternal(removingCrvLps, tokenAmounts[ZUNAMI_USDC_TOKEN_ID]);
        if (withdrawalType == WithdrawalType.OneCoin && tokenIndex != ZUNAMI_USDC_TOKEN_ID) {
            swapUSDCToToken(_config.tokens[tokenIndex]);
        }
    }

    function removeCrvLpsInternal(uint256 removingCrvLps, uint256 minUsdcAmount) internal {
        uint256 crvFraxAmount = crvFraxTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            CRVFRAX_TOKEN_POOL_CRVFRAX_ID_INT,
            0
        );

        fraxUsdcPool.remove_liquidity_one_coin(
            crvFraxAmount,
            FRAX_USDC_POOL_USDC_ID_INT,
            minUsdcAmount
        );
    }

    function withdrawAllSpecific() internal override {
        removeCrvLpsInternal(crvFraxTokenPoolLp.balanceOf(address(this)), 0);
    }

    function sellToken() public {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeIncreaseAllowance(address(crvFraxTokenPool), sellBal);
            crvFraxTokenPool.exchange_underlying(0, 1, sellBal, 0);
        }
    }

    function swapTokenToUSDC(IERC20Metadata token) internal {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) return;

        token.safeTransfer(address(stableConverter), balance);
        stableConverter.handle(
            address(token),
            address(_config.tokens[ZUNAMI_USDC_TOKEN_ID]),
            balance,
            0
        );
    }

    function swapUSDCToToken(IERC20Metadata token) internal {
        uint256 balance = _config.tokens[ZUNAMI_USDC_TOKEN_ID].balanceOf(address(this));
        if (balance == 0) return;

        _config.tokens[ZUNAMI_USDC_TOKEN_ID].safeTransfer(
            address(stableConverter),
            balance
        );
        stableConverter.handle(
            address(_config.tokens[ZUNAMI_USDC_TOKEN_ID]),
            address(token),
            balance,
            0
        );
    }
}
