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

contract BaseCurveConvex4 is Context, Ownable {
    using SafeERC20 for IERC20Metadata;

    uint256 private constant DENOMINATOR = 1e18;

    address[3] public tokens;
    uint256[3] public managementFees;

    ICurvePool4 public pool;
    IERC20Metadata public crv;
    IERC20Metadata public cvx;
    IERC20Metadata public poolLP;
    IERC20Metadata public token;
    IUniswapRouter public router;
    IUniswapV2Pair public crvweth;
    IUniswapV2Pair public wethcvx;
    IUniswapV2Pair public wethusdt;
    IConvexBooster public booster;
    ICurveGauge public gauge;
    IConvexRewards public crvRewards;
    IZunami public zunami;
    uint256 private cvxPID;

    constructor(
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        address gaugeAddr,
        uint256 pid,
        address tokenAddr
    ) {
        pool = ICurvePool4(poolAddr);
        poolLP = IERC20Metadata(poolLPAddr);
        crv = IERC20Metadata(Constants.CRV_ADDRESS);
        cvx = IERC20Metadata(Constants.CVX_ADDRESS);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CRV_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CVX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(rewardsAddr);
        gauge = ICurveGauge(gaugeAddr);
        router = IUniswapRouter(Constants.SUSHI_ROUTER_ADDRESS);
        cvxPID = pid;
        token = IERC20Metadata(tokenAddr);
        tokens[0] = Constants.DAI_ADDRESS;
        tokens[1] = Constants.USDC_ADDRESS;
        tokens[2] = Constants.USDT_ADDRESS;
    }

    modifier onlyZunami() {
        require(
            _msgSender() == address(zunami),
            "CurvetokenConvex: must be called by Zunami contract"
        );
        _;
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function getTotalValue() public view virtual returns (uint256) {
        uint256 lpBalance = gauge.balanceOf(address(this));
        uint256 lpPrice = pool.get_virtual_price();
        (uint112 reserve0, uint112 reserve1, ) = wethcvx.getReserves();
        uint256 cvxPrice = (reserve0 * DENOMINATOR) / reserve1;
        (reserve0, reserve1, ) = crvweth.getReserves();
        uint256 crvPrice = (reserve1 * DENOMINATOR) / reserve0;
        (reserve0, reserve1, ) = wethusdt.getReserves();
        uint256 ethPrice = (reserve0 * DENOMINATOR) / reserve1;
        uint256 sum = 0;
        uint256 decimalsMultiplier = 1;
        if (token.decimals() < 18) {
            decimalsMultiplier = 10**(18 - token.decimals());
        }
        sum += token.balanceOf(address(this)) * decimalsMultiplier;
        for (uint8 i = 0; i < 3; ++i) {
            decimalsMultiplier = 1;
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
        for (uint8 i = 0; i < 3; ++i) {
            IERC20Metadata(tokens[i]).safeIncreaseAllowance(
                address(pool),
                amounts[i]
            );
        }
        uint256[4] memory amounts4;
        for (uint8 i = 0; i < 3; ++i) {
            amounts4[i] = amounts[i];
        }
        pool.add_liquidity(amounts4, 0);
        poolLP.safeApprove(address(booster), poolLP.balanceOf(address(this)));
        booster.depositAll(cvxPID, true);
    }

    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) external virtual onlyZunami {
        uint256[4] memory minAmounts4;
        for (uint8 i = 0; i < 3; ++i) {
            minAmounts4[i] = minAmounts[i];
        }
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts4, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) *
            lpShares) / zunami.totalSupply();
        require(
            depositedShare >= crvRequiredLPs,
            "StrategyCurvetoken: user lps share should be at least required"
        );

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();

        uint256[] memory userBalances = new uint256[](3);
        uint256[] memory prevBalances = new uint256[](3);
        for (uint8 i = 0; i < 3; ++i) {
            prevBalances[i] = IERC20Metadata(tokens[i]).balanceOf(
                address(this)
            );
            userBalances[i] =
                (prevBalances[i] * lpShares) /
                zunami.totalSupply();
        }

        pool.remove_liquidity(depositedShare, minAmounts4);
        sellToken();
        uint256[3] memory liqAmounts;
        for (uint256 i = 0; i < 3; ++i) {
            liqAmounts[i] =
                IERC20Metadata(tokens[i]).balanceOf(address(this)) -
                prevBalances[i];
        }

        uint256 userDeposit = zunami.deposited(depositor);
        uint256 earned = 0;
        for (uint8 i = 0; i < 3; ++i) {
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
        for (uint8 i = 0; i < 3; ++i) {
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
        for (uint8 i = 0; i < 3; ++i) {
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

    function sellToken() public virtual {
        token.safeApprove(address(pool), token.balanceOf(address(this)));
        pool.exchange_underlying(3, 2, token.balanceOf(address(this)), 0);
    }

    function withdrawAll() external virtual onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();

        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[4] memory minAmounts;
        pool.remove_liquidity(lpBalance, minAmounts);
        sellToken();

        for (uint8 i = 0; i < 3; ++i) {
            IERC20Metadata(tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(tokens[i]).balanceOf(address(this)) -
                    managementFees[i]
            );
        }
    }
}
