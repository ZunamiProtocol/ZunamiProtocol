//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePool.sol';
import '../interfaces/ICurvePool2.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexBooster.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IConvexRewards.sol';
import '../interfaces/IZunami.sol';
import './BaseStrat.sol';

contract CurveConvexStrat2 is Context, BaseStrat {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    uint256 public usdtPoolId = 2;
    uint256 public zunamiLpInStrat = 0;
    uint256[4] public decimalsMultiplierS;

    ICurvePool public pool3;
    ICurvePool2 public pool;
    IERC20Metadata public pool3LP;
    IERC20Metadata public poolLP;
    IERC20Metadata public token;
    IUniswapV2Pair public crvweth;
    IUniswapV2Pair public wethcvx;
    IUniswapV2Pair public wethusdt;
    IConvexBooster public booster;
    IConvexRewards public crvRewards;
    IERC20Metadata public extraToken;
    IConvexRewards public extraRewards;
    uint256 public cvxPoolPID;

    constructor(
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    ) {
        pool = ICurvePool2(poolAddr);
        pool3 = ICurvePool(Constants.CRV_3POOL_ADDRESS);
        poolLP = IERC20Metadata(poolLPAddr);
        pool3LP = IERC20Metadata(Constants.CRV_3POOL_LP_ADDRESS);
        crvweth = IUniswapV2Pair(Constants.SUSHI_CRV_WETH_ADDRESS);
        wethcvx = IUniswapV2Pair(Constants.SUSHI_WETH_CVX_ADDRESS);
        wethusdt = IUniswapV2Pair(Constants.SUSHI_WETH_USDT_ADDRESS);
        booster = IConvexBooster(Constants.CVX_BOOSTER_ADDRESS);
        crvRewards = IConvexRewards(rewardsAddr);
        cvxPoolPID = poolPID;
        token = IERC20Metadata(tokenAddr);
        extraToken = IERC20Metadata(extraTokenAddr);
        extraRewards = IConvexRewards(extraRewardsAddr);
        if (extraTokenAddr != address(0)) {
            extraToken = IERC20Metadata(extraTokenAddr);
            extraTokenSwapPath = [extraTokenAddr, Constants.WETH_ADDRESS, Constants.USDT_ADDRESS];
        }
        for (uint256 i; i < 3; i++) {
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplierS[i] = 10**(18 - IERC20Metadata(tokens[i]).decimals());
            } else {
                decimalsMultiplierS[i] = 1;
            }
        }
        if (token.decimals() < 18) {
            decimalsMultiplierS[3] = 10**(18 - token.decimals());
        } else {
            decimalsMultiplierS[3] = 1;
        }
    }

    function getZunamiLpInStrat() external view virtual returns (uint256) {
        return zunamiLpInStrat;
    }

    function totalHoldings() public view virtual returns (uint256) {
        uint256 lpBalance = (crvRewards.balanceOf(address(this)) * pool.get_virtual_price()) /
            DENOMINATOR;
        uint256 cvxHoldings = 0;
        uint256 crvHoldings = 0;
        uint256 extraHoldings = 0;
        uint256[] memory amounts;
        uint256 crvErned = crvRewards.earned(address(this));
        uint256 cvxTotalCliffs = cvx.totalCliffs();

        uint256 amountIn = (crvErned *
            (cvxTotalCliffs - cvx.totalSupply() / cvx.reductionPerCliff())) /
            cvxTotalCliffs +
            cvx.balanceOf(address(this));
        if (amountIn > 0) {
            amounts = router.getAmountsOut(amountIn, cvxToUsdtPath);
            cvxHoldings = amounts[amounts.length - 1];
        }
        amountIn = crvErned + crv.balanceOf(address(this));
        if (amountIn > 0) {
            amounts = router.getAmountsOut(amountIn, crvToUsdtPath);
            crvHoldings = amounts[amounts.length - 1];
        }
        if (address(extraToken) != address(0)) {
            amountIn = extraRewards.earned(address(this)) + extraToken.balanceOf(address(this));
            if (amountIn > 0) {
                amounts = router.getAmountsOut(amountIn, extraTokenSwapPath);
                extraHoldings = amounts[amounts.length - 1];
            }
        }

        uint256 sum = 0;

        sum += token.balanceOf(address(this)) * decimalsMultiplierS[3];

        for (uint256 i = 0; i < 3; i++) {
            sum += IERC20Metadata(tokens[i]).balanceOf(address(this)) * decimalsMultiplierS[i];
        }

        return sum + lpBalance + cvxHoldings + crvHoldings + extraHoldings;
    }

    function deposit(uint256[3] memory amounts) external virtual onlyZunami returns (uint256) {
        uint256 _amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            _amountsTotal += amounts[i] * decimalsMultiplierS[i];
        }
        uint256 amountsMin = (_amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool3.get_virtual_price();
        uint256 depositedLp = pool3.calc_token_amount(amounts, true);
        if ((depositedLp * lpPrice) / 1e18 >= amountsMin) {
            for (uint256 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool3), amounts[i]);
            }
            pool3.add_liquidity(amounts, 0);
            uint256[2] memory amounts2;
            amounts2[1] = pool3LP.balanceOf(address(this));
            pool3LP.safeIncreaseAllowance(address(pool), amounts2[1]);
            uint256 poolLPs = pool.add_liquidity(amounts2, 0);
            poolLP.safeApprove(address(booster), poolLPs);
            booster.depositAll(cvxPoolPID, true);
            return ((poolLPs * pool.get_virtual_price()) / DENOMINATOR);
        } else {
            return (0);
        }
    }

    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) external virtual onlyZunami returns (bool) {
        uint256[2] memory minAmounts2;
        minAmounts2[1] = pool3.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) / zunamiLpInStrat;

        if (depositedShare < pool.calc_token_amount(minAmounts2, false)) {
            return false;
        }

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();
        if (address(extraToken) != address(0)) {
            sellExtraToken();
        }
        uint256[] memory userBalances = new uint256[](3);
        uint256[] memory prevBalances = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            prevBalances[i] = IERC20Metadata(tokens[i]).balanceOf(address(this));
            userBalances[i] = ((prevBalances[i] - managementFee) * lpShares) / zunamiLpInStrat;
        }
        uint256 prevCrv3Balance = pool3LP.balanceOf(address(this));
        pool.remove_liquidity(depositedShare, minAmounts2);
        sellToken();
        uint256 crv3LiqAmount = pool3LP.balanceOf(address(this)) - prevCrv3Balance;
        pool3.remove_liquidity(crv3LiqAmount, minAmounts);

        for (uint256 i = 0; i < 3; i++) {
            IERC20Metadata(tokens[i]).safeTransfer(
                depositor,
                IERC20Metadata(tokens[i]).balanceOf(address(this)) -
                    prevBalances[i] +
                    userBalances[i]
            );
        }

        return true;
    }

    function sellToken() public virtual {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeApprove(address(pool), sellBal);
            pool.exchange_underlying(0, 3, sellBal, 0);
        }
    }

    function sellExtraToken() public virtual {
        uint256 extraBalance = extraToken.balanceOf(address(this));
        if (extraBalance == 0) {
            return;
        }
        extraToken.safeApprove(address(router), extraToken.balanceOf(address(this)));
        uint256 usdtBalanceBefore = IERC20Metadata(tokens[2]).balanceOf(address(this));

        router.swapExactTokensForTokens(
            extraBalance,
            0,
            extraTokenSwapPath,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        managementFees += zunami.calcManagementFee(
            IERC20Metadata(tokens[2]).balanceOf(address(this)) - usdtBalanceBefore
        );

        emit SellRewards(0, 0, extraBalance);
    }

    function withdrawAll() external virtual onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();
        if (address(extraToken) != address(0)) {
            sellExtraToken();
        }

        uint256[2] memory minAmounts2;
        uint256[3] memory minAmounts;
        pool.remove_liquidity(poolLP.balanceOf(address(this)), minAmounts2);
        sellToken();
        pool3.remove_liquidity(pool3LP.balanceOf(address(this)), minAmounts);

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

    function emergency() external onlyOwner {
        crvRewards.withdrawAllAndUnwrap(true);
        uint256[2] memory minAmounts2;
        uint256[3] memory minAmounts;
        pool.remove_liquidity(poolLP.balanceOf(address(this)), minAmounts2);
        pool3.remove_liquidity(pool3LP.balanceOf(address(this)), minAmounts);

        for (uint256 i = 0; i < 3; i++) {
            IERC20Metadata(tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(tokens[i]).balanceOf(address(this))
            );
        }
    }
}
