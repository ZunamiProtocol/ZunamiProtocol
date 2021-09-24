//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../helpers/Constants.sol";
import "../interfaces/ICurveAavePool.sol";
import "../interfaces/ICurveGauge.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapRouter.sol";
import "../interfaces/IConvexBooster.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/IZunami.sol";

import "hardhat/console.sol";

contract CurveAaveConvex is Context, Ownable {
    using SafeERC20 for IERC20Metadata;

    uint256 private constant DENOMINATOR = 1e18;
    uint8 private constant POOL_ASSETS = 3;

    address[3] public tokens;

    uint256[3] public protocolShares;

    ICurveAavePool aavePool;
    IERC20Metadata crv;
    IERC20Metadata cvx;
    IERC20Metadata aaveLP;
    IUniswapRouter router;
    IUniswapV2Pair crvweth;
    IUniswapV2Pair wethcvx;
    IUniswapV2Pair wethusdt;
    IConvexBooster booster;
    ICurveGauge gauge;
    IConvexRewards crvRewards;
    IZunami zunami;

    constructor() {
        aavePool = ICurveAavePool(Constants.CRV_AAVE_ADDRESS);
        aaveLP = IERC20Metadata(Constants.CRV_AAVE_LP_ADDRESS);
        crv = IERC20Metadata(Constants.CRV_ADDRESS);
        cvx = IERC20Metadata(Constants.CVX_ADDRESS);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CRV_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CVX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(Constants.CVX_REWARDS_ADDRESS);
        gauge = ICurveGauge(Constants.CRV_AAVE_GAUGE_ADDRESS);
        router = IUniswapRouter(Constants.SUSHI_ROUTER_ADDRESS);
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            tokens[i] = aavePool.underlying_coins(i);
        }
    }

    modifier onlyZunami() {
        require(
            _msgSender() == address(zunami),
            "CurveAaveConvex: must be called by Zunami contract"
        );
        _;
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function getTotalValue() public view returns (uint256) {
        uint256 lpBalance = gauge.balanceOf(address(this));
        uint256 lpPrice = aavePool.get_virtual_price();
        uint256 cvxPrice = wethcvx.price1CumulativeLast();
        uint256 crvPrice = crvweth.price0CumulativeLast();
        uint256 ethPrice = wethusdt.price0CumulativeLast();
        uint256 sum = 0;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                    10**(18 - IERC20Metadata(tokens[i]).decimals());
            }
            sum +=
                IERC20Metadata(tokens[i]).balanceOf(address(this)) *
                decimalsMultiplier;
        }
        return
            sum +
            (lpBalance *
                lpPrice +
                ((ethPrice * crvPrice) / DENOMINATOR) *
                (crvRewards.earned(address(this)) +
                    crv.balanceOf(address(this))) +
                ((ethPrice * cvxPrice) / DENOMINATOR) *
                (crvRewards.earned(address(this)) +
                    cvx.balanceOf(address(this)))) /
            DENOMINATOR;
    }

    function deposit(uint256[3] memory amounts) external onlyZunami {
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20Metadata(tokens[i]).safeIncreaseAllowance(
                Constants.CRV_AAVE_ADDRESS,
                amounts[i]
            );
        }

        uint256 aaveLPs = aavePool.add_liquidity(amounts, 0, true);
        aaveLP.safeApprove(Constants.CVX_BOOSTER_ADDRESS, aaveLPs);
        booster.depositAll(Constants.CVX_AAVE_PID, true);
    }

    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) external onlyZunami {
        uint256 crvRequiredLPs = aavePool.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) *
            lpShares) / zunami.totalSupply();
        require(
            depositedShare >= crvRequiredLPs,
            "StrategyCurveAave: user lps share should be at least required"
        );

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();

        uint256[] memory balances = new uint256[](POOL_ASSETS);
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            balances[i] =
                (IERC20Metadata(tokens[i]).balanceOf(address(this)) *
                    lpShares) /
                zunami.totalSupply();
        }

        uint256[3] memory liqAmounts = aavePool.remove_liquidity(
            depositedShare,
            minAmounts,
            true
        );

        uint256 totalDeposited = zunami.totalDeposited();
        uint256 userDeposit = (lpShares * totalDeposited) /
            zunami.totalSupply();

        uint256 earned = 0;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                    10**(18 - IERC20Metadata(tokens[i]).decimals());
            }
            earned += (liqAmounts[i] + balances[i]) * decimalsMultiplier;
        }

        uint256 protocolFee = zunami.calculateFee(
            (earned < userDeposit ? 0 : earned - userDeposit)
        );

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                    10**(18 - IERC20Metadata(tokens[i]).decimals());
            }
            uint256 protocolShare = (protocolFee *
                (liqAmounts[i] + balances[i])) / earned;
            protocolShares[i] += protocolShare;
            IERC20Metadata(tokens[i]).safeTransfer(
                depositor,
                liqAmounts[i] + balances[i] - protocolShare
            );
        }
    }

    function claimProfit() external onlyZunami {
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            uint256 protocolShare = protocolShares[i];
            protocolShares[i] = 0;
            IERC20Metadata(tokens[i]).safeTransfer(owner(), protocolShare);
        }
    }

    function sellCrvCvx() public {
        cvx.safeApprove(address(router), cvx.balanceOf(address(this)));
        crv.safeApprove(address(router), crv.balanceOf(address(this)));

        address[] memory path = new address[](3);
        path[0] = Constants.CVX_ADDRESS;
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDT_ADDRESS;
        router.swapExactTokensForTokens(
            cvx.balanceOf(address(this)),
            0,
            path,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        path[0] = Constants.CRV_ADDRESS;
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDT_ADDRESS;
        router.swapExactTokensForTokens(
            crv.balanceOf(address(this)),
            0,
            path,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );
    }

    function withdrawAll() external onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();

        uint256 lpBalance = aaveLP.balanceOf(address(this));
        uint256[3] memory minAmounts;
        uint256[3] memory amounts = aavePool.remove_liquidity(
            lpBalance,
            minAmounts,
            true
        );

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20Metadata(tokens[i]).safeTransfer(_msgSender(), amounts[i]);
        }
    }
}
