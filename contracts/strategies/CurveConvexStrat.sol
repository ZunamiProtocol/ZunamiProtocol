//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePoolUnderlying.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexBooster.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IConvexRewards.sol';
import '../interfaces/IZunami.sol';
import "./BaseStrat.sol";

contract CurveConvexStrat is Context, BaseStrat {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    uint256 public usdtPoolId = 2;
    uint256 public zunamiLpInStrat = 0;
    uint256[3] public decimalsMultiplierS;

    ICurvePoolUnderlying public pool;
    IERC20Metadata public poolLP;
    IUniswapV2Pair public crvweth;
    IUniswapV2Pair public wethcvx;
    IUniswapV2Pair public wethusdt;
    IConvexBooster public booster;
    IConvexRewards public crvRewards;
    IERC20Metadata public extraToken;
    IUniswapV2Pair public extraPair;
    IConvexRewards public extraRewards;
    uint256 public cvxPoolPID;

    constructor(
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID,
        address extraRewardsAddr,
        address extraTokenAddr,
        address extraTokenPairAddr
    ) {
        pool = ICurvePoolUnderlying(poolAddr);
        poolLP = IERC20Metadata(poolLPAddr);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CRV_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CVX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(rewardsAddr);
        cvxPoolPID = poolPID;
        extraToken = IERC20Metadata(extraTokenAddr);
        extraPair = IUniswapV2Pair(extraTokenPairAddr);
        extraRewards = IConvexRewards(extraRewardsAddr);
        for (uint256 i; i < 3; i++) {
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplierS[i] =
                10 ** (18 - IERC20Metadata(tokens[i]).decimals());
            } else {
                decimalsMultiplierS[i] = 1;
            }
        }
    }

    function getZunamiLpInStrat() external view virtual returns (uint256) {
        return zunamiLpInStrat;
    }

    function totalHoldings() public view virtual returns (uint256) {
        uint256 lpBalance = crvRewards.balanceOf(address(this)) * pool.get_virtual_price() / DENOMINATOR;
        uint256 cvxHoldings = 0;
        uint256 crvHoldings = 0;
        uint256[] memory amounts;
        uint256 crvErned = crvRewards.earned(address(this));
        uint256 cvxTotalCliffs = cvx.totalCliffs();

        uint256 amountIn = (crvErned * (cvxTotalCliffs - cvx.totalSupply() / cvx.reductionPerCliff()))
        / cvxTotalCliffs + cvx.balanceOf(address(this));
        if (amountIn > 0) {
            amounts = router.getAmountsOut(amountIn, cvxToUsdtPath);
            cvxHoldings = amounts[amounts.length - 1];
        }

        amountIn = crvErned + crv.balanceOf(address(this));
        if (amountIn > 0) {
            amounts = router.getAmountsOut(amountIn, crvToUsdtPath);
            crvHoldings = amounts[amounts.length - 1];
        }

        uint256 sum = 0;
        for (uint256 i = 0; i < 3; ++i) {
            sum +=
            IERC20Metadata(tokens[i]).balanceOf(address(this)) *
            decimalsMultiplierS[i];
        }

        return sum + lpBalance + cvxHoldings + crvHoldings;
    }

    function deposit(uint256[3] memory amounts) external virtual onlyZunami returns (uint256) {
        uint256 _amountsTotal;
        for (uint256 i = 0; i < 3; ++i) {
            _amountsTotal += amounts[i] * decimalsMultiplierS[i];
        }
        uint256 amountsMin = _amountsTotal * minDepositAmount / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts, true);
        if (depositedLp * lpPrice / 1e18 >= amountsMin) {
            for (uint256 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool), amounts[i]);
            }
            uint256 poolLPs = pool.add_liquidity(amounts, 0, true);
            poolLP.safeApprove(address(booster), poolLPs);
            booster.depositAll(cvxPoolPID, true);
            return (poolLPs * pool.get_virtual_price() / DENOMINATOR);
        } else {
            return (0);
        }
    }

    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) external virtual onlyZunami returns (bool) {
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) / zunamiLpInStrat;

        if (depositedShare < crvRequiredLPs) {
            return false;
        }

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();

        uint256[] memory userBalances = new uint256[](3);
        uint256[] memory prevBalances = new uint256[](3);
        for (uint256 i = 0; i < 3; ++i) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            prevBalances[i] = IERC20Metadata(tokens[i]).balanceOf(
                address(this)
            );
            userBalances[i] =
            ((prevBalances[i] - managementFee) * lpShares) /
            zunamiLpInStrat;
        }

        pool.remove_liquidity(depositedShare, minAmounts, true);

        for (uint256 i = 0; i < 3; ++i) {
            IERC20Metadata(tokens[i]).safeTransfer(
                depositor,
                IERC20Metadata(tokens[i]).balanceOf(address(this)) - prevBalances[i] + userBalances[i]
            );
        }

        return true;
    }

    function withdrawAll() external virtual onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();

        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[3] memory minAmounts;
        pool.remove_liquidity(lpBalance, minAmounts, true);

        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            IERC20Metadata(tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(tokens[i]).balanceOf(address(this)) - managementFee
            );
        }
    }

    function updateZunamiLpInStrat(uint256 _amount, bool _isMint) external onlyZunami {
        _isMint ? (zunamiLpInStrat += _amount) : (zunamiLpInStrat -= _amount);
    }
}
