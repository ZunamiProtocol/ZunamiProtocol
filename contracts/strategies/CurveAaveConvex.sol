//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../helpers/Constants.sol";
import "../interfaces/ICurveAavePool.sol";
import "../interfaces/ICurveGauge.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapRouter.sol";
import "../interfaces/IConvexBooster.sol";
import "../interfaces/IConvexRewards.sol";

contract CurveAaveConvex is Context, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant NORMALIZER = 1e18;
    uint8 private constant POOL_ASSETS = 3;

    address[3] public tokens;

    ICurveAavePool aavePool;
    IERC20 crv;
    IERC20 cvx;
    IERC20 aaveLP;
    IUniswapRouter router;
    IUniswapV2Pair crvweth;
    IUniswapV2Pair wethcvx;
    IUniswapV2Pair wethusdt;
    IConvexBooster booster;
    ICurveGauge gauge;
    IConvexRewards crvRewards;
    IConvexRewards stakerRewards;

    constructor() {
        aavePool = ICurveAavePool(Constants.CURVE_AAVE_ADDRESS);
        aaveLP = IERC20(Constants.CURVE_AAVE_LP_ADDRESS);
        crv = IERC20(Constants.CURVE_TOKEN_ADDRESS);
        cvx = IERC20(Constants.CONVEX_TOKEN_ADDRESS);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CURVE_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CONVEX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(Constants.CONVEX_CURVE_REWARDS_ADDRESS);
        stakerRewards = IConvexRewards(Constants.CONVEX_STAKER_REWARDS_ADDRESS);
        gauge = ICurveGauge(Constants.CURVE_AAVE_GAUGE_ADDRESS);

        address[] memory underlyings = aavePool.underlying_coins();
        require(
            underlyings.length == POOL_ASSETS,
            "StrategyCurveAave: must have 3 assets in pool"
        );
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            tokens[i] = underlyings[i];
        }
    }

    function getTotalValue() public returns (uint256) {
        uint256 lpBalance = gauge.balanceOf(address(this));
        uint256 lpPrice = aavePool.get_virtual_price();
        uint256 convexPrice = wethcvx.price1CumulativeLast();
        uint256 curvePrice = crvweth.price0CumulativeLast();
        uint256 ethPrice = wethusdt.price0CumulativeLast();
        uint256 sum = 0;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            sum += IERC20(tokens[i]).balanceOf(address(this));
        }
        return
            sum +
            (lpBalance *
                lpPrice +
                ((ethPrice * curvePrice) / NORMALIZER) *
                (crvRewards.earned(address(this)) +
                    crv.balanceOf(address(this))) +
                ((ethPrice * convexPrice) / NORMALIZER) *
                (stakerRewards.balanceOf(address(this)) +
                    cvx.balanceOf(address(this)))) /
            NORMALIZER;
    }

    function deposit(uint256[] calldata amounts) external onlyOwner {
        require(
            amounts.length == POOL_ASSETS,
            "StrategyCurveAave: must have length 3"
        );

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20(tokens[i]).safeApprove(
                Constants.CURVE_AAVE_ADDRESS,
                amounts[i]
            );
        }
        uint256 lps = aavePool.add_liquidity(amounts, 0, true);
        aaveLP.safeApprove(Constants.CONVEX_BOOSTER_ADDRESS, lps);
        booster.depositAll(Constants.CONVEX_AAVE_PID, true);
    }

    function withdrawRewards() public {
        crvRewards.withdrawAllAndUnwrap(true);
        stakerRewards.withdrawAllAndUnwrap(true);
    }

    function withdraw(
        address depositor,
        uint256 lpsShare,
        uint256 totalSupply,
        uint256[] calldata minAmounts
    ) external onlyOwner {
        require(
            minAmounts.length == POOL_ASSETS,
            "StrategyCurveAave: must have length 3"
        );

        uint256 curveRequiredLPs = aavePool.calc_token_amount(
            minAmounts,
            false
        );
        uint256 depositedShare = (gauge.balanceOf(address(this)) * lpsShare) /
            totalSupply;
        require(
            depositedShare >= curveRequiredLPs,
            "StrategyCurveAave: user lps share should be at least required"
        );
        booster.withdraw(Constants.CONVEX_AAVE_PID, depositedShare);
        withdrawRewards();
        sellCrvCvx();
        uint256[] memory balances = new uint256[](POOL_ASSETS);
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            balances[i] =
                (IERC20(tokens[i]).balanceOf(address(this)) * lpsShare) /
                totalSupply;
        }

        uint256[] memory amounts = aavePool.remove_liquidity(
            minAmounts,
            depositedShare,
            true
        );

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20(tokens[i]).safeTransfer(depositor, amounts[i] + balances[i]);
        }
    }

    function sellCrvCvx() public {
        address[] memory path = new address[](2);
        path[0] = Constants.SUSHI_WETH_CVX_ADDRESS;
        path[1] = Constants.SUSHI_WETH_USDT_ADDRESS;
        router.swapExactTokensForTokens(
            cvx.balanceOf(address(this)),
            0,
            path,
            address(this),
            Constants.TRADE_DEADLINE
        );
        path[0] = Constants.SUSHI_CURVE_WETH_ADDRESS;
        path[1] = Constants.SUSHI_WETH_USDT_ADDRESS;
        router.swapExactTokensForTokens(
            crv.balanceOf(address(this)),
            0,
            path,
            address(this),
            Constants.TRADE_DEADLINE
        );
    }

    function withdrawAll() external onlyOwner {
        booster.withdrawAll(Constants.CONVEX_AAVE_PID);
        withdrawRewards();
        sellCrvCvx();

        uint256 lpBalance = aaveLP.balanceOf(address(this));
        uint256[] memory minAmounts = new uint256[](POOL_ASSETS);
        uint256[] memory amounts = aavePool.remove_liquidity(
            minAmounts,
            lpBalance,
            true
        );

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20(tokens[i]).safeTransfer(_msgSender(), amounts[i]);
        }
    }
}
