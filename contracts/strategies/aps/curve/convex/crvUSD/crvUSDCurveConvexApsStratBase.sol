//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../CurveConvexExtraApsStratBase.sol';
import '../../../../../utils/Constants.sol';
import '../../../../interfaces/ICurvePool2.sol';
import '../../../../../interfaces/IStrategy.sol';
import "../../../../../interfaces/IZunamiVault.sol";
import "../../../../../interfaces/IZunamiStableVault.sol";

abstract contract crvUSDCurveConvexApsStratBase is CurveConvexExtraApsStratBase {
    using SafeERC20 for IERC20Metadata;

    uint256 private constant CRVUSD_TOKEN_POOL_TOKEN_ID = 0;
    int128 constant CRVUSD_TOKEN_POOL_TOKEN_ID_INT = 0;

    uint256 constant CRVUSD_TOKEN_POOL_CRVUSD_ID = 1;
    int128 constant CRVUSD_TOKEN_POOL_CRVUSD_ID_INT = 1;

    IZunamiVault public immutable zunamiPool;
    IZunamiStableVault public immutable zunamiStable;

    // crvUSDTokenPool = crvUSD + Token
    ICurvePool2 public immutable crvUSDTokenPool;
    IERC20Metadata public immutable crvUSDTokenPoolLp;

    constructor(
        Config memory config,
        address zunamiPoolAddr,
        address zunamiStableAddr,
        address fraxUsdcPoolAddr,
        address fraxUsdcPoolLpAddr,
        address crvUSDTokenPoolAddr,
        address crvUSDTokenPoolLpAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexExtraApsStratBase(
            config,
            crvUSDTokenPoolLpAddr,
            rewardsAddr,
            poolPID,
            tokenAddr,
            extraRewardsAddr,
            extraTokenAddr
        )
    {
        zunamiPool = IZunamiVault(zunamiPoolAddr);
        zunamiStable = IZunamiStableVault(zunamiStableAddr);

        fraxUsdcPool = ICurvePool2(fraxUsdcPoolAddr);
        fraxUsdcPoolLp = IERC20Metadata(fraxUsdcPoolLpAddr);

        crvUSDTokenPool = ICurvePool2(crvUSDTokenPoolAddr);
        crvUSDTokenPoolLp = IERC20Metadata(crvUSDTokenPoolLpAddr);
    }

    function checkDepositSuccessful(uint256 tokenAmount)
        internal
        view
        override
        returns (bool isValidDepositAmount)
    {
        uint256 amountsMin = (tokenAmount * minDepositAmount) / DEPOSIT_DENOMINATOR;

        uint256[2] memory amounts;
        amounts[CRVUSD_TOKEN_POOL_TOKEN_ID] = tokenAmount;

        uint256 lpPrice = crvUSDTokenPool.get_virtual_price();
        uint256 depositedLp = crvUSDTokenPool.calc_token_amount(amounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256 tokenAmount, uint256 usdcAmount)
    internal
    override
    returns (uint256 poolLpAmount)
    {
        uint256 crvFraxAmount;

        if(usdcAmount > 0) {
            uint256[2] memory amounts;
            amounts[FRAX_USDC_POOL_USDC_ID] = usdcAmount;
            IERC20Metadata(Constants.USDC_ADDRESS).safeIncreaseAllowance(
                address(fraxUsdcPool),
                usdcAmount
            );

            crvFraxAmount = fraxUsdcPool.add_liquidity(amounts, 0);
            fraxUsdcPoolLp.safeIncreaseAllowance(address(crvUSDTokenPool), crvFraxAmount);
        }

        if(tokenAmount > 0) {
            token.safeIncreaseAllowance(address(crvUSDTokenPool), tokenAmount);
        }

        uint256[2] memory tokenPoolAmounts;
        tokenPoolAmounts[CRVUSD_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        tokenPoolAmounts[CRVUSD_TOKEN_POOL_CRVUSD_ID] = crvFraxAmount;
        poolLpAmount = crvUSDTokenPool.add_liquidity(tokenPoolAmounts, 0);

        crvUSDTokenPoolLp.safeIncreaseAllowance(address(_config.booster), poolLpAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return crvUSDTokenPool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps)
        external
        view
        override
        returns (uint256)
    {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        return crvUSDTokenPool.calc_withdraw_one_coin(
            removingCrvLps,
            CRVUSD_TOKEN_POOL_CRVUSD_ID_INT
        );
    }

    function calcSharesAmount(uint256 tokenAmount, bool isDeposit)
        external
        view
        override
        returns (uint256)
    {
        uint256[2] memory tokenAmounts2;
        tokenAmounts2[CRVUSD_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        return crvUSDTokenPool.calc_token_amount(tokenAmounts2, isDeposit);
    }

    function calcCrvLps(
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256 tokenAmount
    )
        internal
        view
        override
        returns (
            bool success,
            uint256 removingCrvLps
        )
    {
        removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;

        uint256[2] memory minAmounts;
        minAmounts[CRVUSD_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        success = removingCrvLps >= crvUSDTokenPool.calc_token_amount(minAmounts, false);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256 tokenAmount
    ) internal override {
        removeCrvLpsInternal(removingCrvLps, tokenAmount);
    }

    function removeCrvLpsInternal(uint256 removingCrvLps, uint256 minTokenAmount) internal {
        crvUSDTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            CRVUSD_TOKEN_POOL_TOKEN_ID_INT,
            minTokenAmount
        );
    }

    function withdrawAllSpecific() internal override {
        removeCrvLpsInternal(crvUSDTokenPoolLp.balanceOf(address(this)), 0);
    }

    function sellToken() public {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeIncreaseAllowance(address(crvUSDTokenPool), sellBal);
            crvUSDTokenPool.exchange_underlying(0, 1, sellBal, 0);
        }
    }

    function inflate(uint256 ratioOfCrvLps, uint256 minInflatedAmount) external onlyOwner {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * ratioOfCrvLps) / 1e18;

        cvxRewards.withdrawAndUnwrap(removingCrvLps, false);

        uint256 crvFraxAmount = crvUSDTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            CRVUSD_TOKEN_POOL_CRVUSD_ID_INT,
            0
        );

        uint256 usdcAmount = fraxUsdcPool.remove_liquidity_one_coin(
            crvFraxAmount,
            FRAX_USDC_POOL_USDC_ID_INT,
            minInflatedAmount
        );

        IERC20Metadata(Constants.USDC_ADDRESS).safeIncreaseAllowance(address(zunamiPool), usdcAmount);
        uint256 zlpAmount = zunamiPool.deposit([0,usdcAmount,0]);

        IERC20Metadata(address(zunamiPool)).safeIncreaseAllowance(address(zunamiStable), zlpAmount);
        zunamiStable.deposit(zlpAmount, address(this));

        uint256 uzdAmount = IERC20Metadata(address(zunamiStable)).balanceOf(address(this));

        depositPool(uzdAmount, 0);
    }

    function deflate(uint256 ratioOfCrvLps, uint256 minDeflateAmount) external onlyOwner {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * ratioOfCrvLps) / 1e18;

        cvxRewards.withdrawAndUnwrap(removingCrvLps, false);

        uint256 tokenAmount = crvUSDTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            CRVUSD_TOKEN_POOL_TOKEN_ID_INT,
            0
        );

        IERC20Metadata(address(zunamiStable)).safeIncreaseAllowance(address(zunamiStable), tokenAmount);
        zunamiStable.withdraw(tokenAmount, address(this), address(this));

        uint256 zlpAmount = IERC20Metadata(address(zunamiPool)).balanceOf(address(this));

        IERC20Metadata(address(zunamiPool)).safeIncreaseAllowance(address(zunamiPool), zlpAmount);
        zunamiPool.withdraw(
            zlpAmount,
            [0, minDeflateAmount, 0],
            IStrategy.WithdrawalType.OneCoin,
            ZUNAMI_USDC_TOKEN_ID
        );

        uint256 usdcAmount = IERC20Metadata(Constants.USDC_ADDRESS).balanceOf(address(this));

        depositPool(0, usdcAmount - managementFees);
    }
}
