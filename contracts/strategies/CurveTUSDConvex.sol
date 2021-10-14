//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../utils/Constants.sol";
import "../interfaces/ICurvePool4.sol";
import "../interfaces/ICurveGauge.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapRouter.sol";
import "../interfaces/IConvexBooster.sol";
import "../interfaces/IConvexRewards.sol";
import "../interfaces/IZunami.sol";

import "hardhat/console.sol";

contract CurveTUSDConvex is Context, Ownable {
    using SafeERC20 for IERC20Metadata;

    uint256 private constant DENOMINATOR = 1e18;
    uint8 private constant POOL_ASSETS = 3;

    address[3] public tokens;

    uint256[3] public managementFees;

    ICurvePool4 tusdPool;
    IERC20Metadata crv;
    IERC20Metadata cvx;
    IERC20Metadata tusdLP;
    IERC20Metadata tusd;
    IUniswapRouter router;
    IUniswapV2Pair crvweth;
    IUniswapV2Pair wethcvx;
    IUniswapV2Pair wethusdt;
    IConvexBooster booster;
    ICurveGauge gauge;
    IConvexRewards crvRewards;
    IZunami zunami;

    constructor() {
        tusdPool = ICurvePool4(Constants.CRV_TUSD_ADDRESS);
        tusdLP = IERC20Metadata(Constants.CRV_TUSD_LP_ADDRESS);
        crv = IERC20Metadata(Constants.CRV_ADDRESS);
        cvx = IERC20Metadata(Constants.CVX_ADDRESS);
        tusd = IERC20Metadata(Constants.TUSD_ADDRESS);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CRV_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CVX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(Constants.CVX_TUSD_REWARDS_ADDRESS);
        gauge = ICurveGauge(Constants.CRV_TUSD_GAUGE_ADDRESS);
        router = IUniswapRouter(Constants.SUSHI_ROUTER_ADDRESS);
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            tokens[i] = tusdPool.underlying_coins(i + 1);
        }
    }

    modifier onlyZunami() {
        require(
            _msgSender() == address(zunami),
            "CurvetusdConvex: must be called by Zunami contract"
        );
        _;
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function getTotalValue() public view virtual returns (uint256) {
        uint256 lpBalance = gauge.balanceOf(address(this));
        uint256 lpPrice = tusdPool.get_virtual_price();
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

    function deposit(uint256[3] memory amounts) external virtual onlyZunami {
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20Metadata(tokens[i]).safeIncreaseAllowance(
                Constants.CRV_TUSD_ADDRESS,
                amounts[i]
            );
        }
        uint256[4] memory amounts4;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            amounts4[i + 1] = amounts[i];
        }
        uint256 tusdLPs = tusdPool.add_liquidity(amounts4, 0, true);
        tusdLP.safeApprove(Constants.CVX_BOOSTER_ADDRESS, tusdLPs);
        booster.depositAll(Constants.CVX_TUSD_PID, true);
    }

    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) external virtual onlyZunami {
        uint256[4] memory minAmounts4;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            minAmounts4[i + 1] = minAmounts[i];
        }
        uint256 crvRequiredLPs = tusdPool.calc_token_amount(minAmounts4, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) *
            lpShares) / zunami.totalSupply();
        require(
            depositedShare >= crvRequiredLPs,
            "StrategyCurvetusd: user lps share should be at least required"
        );

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();
        sellTUSD();

        uint256[] memory userBalances = new uint256[](POOL_ASSETS);
        uint256[] memory prevBalances = new uint256[](POOL_ASSETS);
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            prevBalances[i] = IERC20Metadata(tokens[i]).balanceOf(
                address(this)
            );
            userBalances[i] =
                (prevBalances[i] * lpShares) /
                zunami.totalSupply();
        }

        tusdPool.remove_liquidity(depositedShare, minAmounts4, true);
        uint256[3] memory liqAmounts;
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            liqAmounts[i] =
                IERC20Metadata(tokens[i]).balanceOf(address(this)) -
                prevBalances[i];
        }

        uint256 userDeposit = zunami.deposited(depositor);
        uint256 earned = 0;
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                    10**(18 - IERC20Metadata(tokens[i]).decimals());
            }
            earned += (liqAmounts[i] + userBalances[i]) * decimalsMultiplier;
        }

        uint256 managementFee = zunami.calcManagementFee(
            (earned < userDeposit ? 0 : earned - userDeposit)
        );
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 managementFeePerAsset = (managementFee *
                (liqAmounts[i] + userBalances[i])) / earned;
            managementFees[i] += managementFeePerAsset;

            IERC20Metadata(tokens[i]).safeTransfer(
                depositor,
                liqAmounts[i] + userBalances[i] - managementFeePerAsset
            );
        }
    }

    function claimManagementFees() external virtual onlyZunami {
        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            uint256 managementFee = managementFees[i];
            managementFees[i] = 0;
            IERC20Metadata(tokens[i]).safeTransfer(owner(), managementFee);
        }
    }

    function sellCrvCvx() public virtual {
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

    function sellTUSD() public virtual {
        tusd.safeApprove(address(router), cvx.balanceOf(address(this)));

        address[] memory path = new address[](3);
        path[0] = Constants.TUSD_ADDRESS;
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDT_ADDRESS;
        router.swapExactTokensForTokens(
            cvx.balanceOf(address(this)),
            0,
            path,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );
    }

    function withdrawAll() external virtual onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();
        sellTUSD();

        uint256 lpBalance = tusdLP.balanceOf(address(this));
        uint256[4] memory minAmounts;
        tusdPool.remove_liquidity(lpBalance, minAmounts, true);

        for (uint8 i = 0; i < POOL_ASSETS; ++i) {
            IERC20Metadata(tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(tokens[i]).balanceOf(address(this)) -
                    managementFees[i]
            );
        }
    }
}
