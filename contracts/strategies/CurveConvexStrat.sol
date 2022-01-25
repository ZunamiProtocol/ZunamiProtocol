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
    }

    function getZunamiLpInStrat() external view virtual returns (uint256) {
        return zunamiLpInStrat;
    }

    function totalHoldings() external view virtual returns (uint256) {
        uint256 lpBalance = crvRewards.balanceOf(address(this));
        uint256 lpPrice = pool.get_virtual_price();
        (uint112 reserve0, uint112 reserve1, ) = wethcvx.getReserves();
        uint256 cvxPrice = (reserve1 * DENOMINATOR) / reserve0;
        (reserve0, reserve1, ) = crvweth.getReserves();
        uint256 crvPrice = (reserve0 * DENOMINATOR) / reserve1;
        (reserve0, reserve1, ) = wethusdt.getReserves();
        uint256 ethPrice = (reserve1 * USD_MULTIPLIER * DENOMINATOR) / reserve0;
        crvPrice = (crvPrice * ethPrice) / DENOMINATOR;
        cvxPrice = (cvxPrice * ethPrice) / DENOMINATOR;
        uint256 sum = 0;
        for (uint256 i = 0; i < 3; ++i) {
            sum +=
            IERC20Metadata(tokens[i]).balanceOf(address(this)) *
            decimalsMultiplierS[i];
        }

        return sum + lpBalance + cvxHoldings + crvHoldings;
    }

    function deposit(uint256[3] memory amounts) external virtual onlyZunami returns (uint256) {
        uint256[3] memory _amounts;
        for (uint8 i = 0; i < 3; i++) {
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                _amounts[i] = amounts[i] * 10 ** (18 - IERC20Metadata(tokens[i]).decimals());
            } else {
                _amounts[i] = amounts[i];
            }
        }
        uint256 amountsMin = ((_amounts[0] + _amounts[1] + _amounts[2]) * minDepositAmount) /
        DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts, true);
        if ((depositedLp * lpPrice) / 1e18 >= amountsMin) {
            for (uint8 i = 0; i < 3; i++) {
                IERC20Metadata(tokens[i]).safeIncreaseAllowance(address(pool), amounts[i]);
            }
            uint256 poolLPs = pool.add_liquidity(amounts, 0, true);
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
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (crvRewards.balanceOf(address(this)) * lpShares) / zunamiLpInStrat;

        if (depositedShare < crvRequiredLPs) {
            return false;
        }

        crvRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();

        uint256[] memory userBalances = new uint256[](3);
        uint256[] memory prevBalances = new uint256[](3);
        for (uint8 i = 0; i < 3; i++) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            prevBalances[i] = IERC20Metadata(tokens[i]).balanceOf(address(this));
            userBalances[i] = ((prevBalances[i] - managementFee) * lpShares) / zunamiLpInStrat;
        }

        pool.remove_liquidity(depositedShare, minAmounts, true);
        uint256[3] memory liqAmounts;
        for (uint256 i = 0; i < 3; i++) {
            liqAmounts[i] = IERC20Metadata(tokens[i]).balanceOf(address(this)) - prevBalances[i];
        }

        for (uint8 i = 0; i < 3; i++) {
            uint256 managementFee = (i == usdtPoolId) ? managementFees : 0;
            IERC20Metadata(tokens[i]).safeTransfer(
                depositor,
                liqAmounts[i] + userBalances[i] - managementFee
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

        for (uint8 i = 0; i < 3; i++) {
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
