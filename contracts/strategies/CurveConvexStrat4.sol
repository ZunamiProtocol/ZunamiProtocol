//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePool4.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexBooster.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IConvexRewards.sol';
import '../interfaces/IZunami.sol';
import './BaseStrat.sol';

contract CurveConvexStrat4 is Context, BaseStrat {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    uint256 public usdtPoolId = 2;
    uint256[4] public decimalsMultiplierS;

    ICurvePool4 public pool;
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
        pool = ICurvePool4(poolAddr);
        poolLP = IERC20Metadata(poolLPAddr);
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

    /**
     * @dev Returns total USD holdings in strategy.
     * return amount is lpBalance x lpPrice + cvx x cvxPrice + crv * crvPrice + extraToken * extraTokenPrice.
     * @return Returns total USD holdings in strategy
     */
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

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amounts - amounts in stablecoins that user deposit
     */
    function deposit(uint256[3] memory amounts) external virtual onlyZunami returns (uint256) {
        // check decimal amounts
        uint256 decAmounts = 0;
        uint256[4] memory amounts4;
        for (uint256 i = 0; i < 3; i++) {
            decAmounts += amounts[i] * decimalsMultiplierS[i];
            amounts4[i] = amounts[i];
        }

        uint256 amountsMin = (decAmounts * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts4, true);

        if ((depositedLp * lpPrice) / 1e18 >= amountsMin) {
            for (uint256 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool), amounts[i]);
            }
            uint256 depositedAmount = pool.calc_token_amount(amounts4, true);
            pool.add_liquidity(amounts4, 0);
            poolLP.safeApprove(address(booster), poolLP.balanceOf(address(this)));
            booster.depositAll(cvxPoolPID, true);
            return ((depositedAmount * pool.get_virtual_price()) / DENOMINATOR);
        } else {
            return (0);
        }
    }

    /**
     * @dev Returns true if withdraw success and false if fail.
     * Withdraw failed when user depositedShare < crvRequiredLPs (wrong minAmounts)
     * @return Returns true if withdraw success and false if fail.
     * @param depositor - address of user that deposit funds
     * @param lpShares - amount of ZLP for withdraw
     * @param minAmounts -  array of amounts stablecoins that user want minimum receive
     */
    function withdraw(
        address depositor,
        uint256 lpShares,
        uint256[3] memory minAmounts,
        uint256 pid
    ) external virtual onlyZunami returns (bool) {
        uint256[4] memory minAmounts4;
        for (uint256 i = 0; i < 3; i++) {
            minAmounts4[i] = minAmounts[i];
        }
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts4, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) /
            zunami.getZunamiLpInStrat(pid);

        if (depositedShare < crvRequiredLPs) {
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
            userBalances[i] =
                ((prevBalances[i] - managementFee) * lpShares) /
                zunami.getZunamiLpInStrat(pid);
        }

        pool.remove_liquidity(depositedShare, minAmounts4);
        sellToken();
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

    /**
     * @dev sell extra reward token on strategy can be called by anyone
     */
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

    /**
     * @dev sell base token on strategy can be called by anyone
     */
    function sellToken() public virtual {
        token.safeApprove(address(pool), token.balanceOf(address(this)));
        pool.exchange_underlying(3, 2, token.balanceOf(address(this)), 0);
    }

    /**
     * @dev can be called by Zunami contract.
     * This function need for moveFunds between strategys.
     */
    function withdrawAll() external virtual onlyZunami {
        crvRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();
        if (address(extraToken) != address(0)) {
            sellExtraToken();
        }

        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[4] memory minAmounts;
        pool.remove_liquidity(lpBalance, minAmounts);
        sellToken();

        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            IERC20Metadata(tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(tokens[i]).balanceOf(address(this)) - managementFee
            );
        }
    }
}
