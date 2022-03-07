//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import '../interfaces/ICurvePoolUnderlying.sol';
import './CurveConvexStratBase.sol';

contract CurveConvexStrat is Context, CurveConvexStratBase {
    using SafeERC20 for IERC20Metadata;

    ICurvePoolUnderlying public pool;

    constructor(
        Config memory config,
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID
    ) CurveConvexStratBase(config, poolLPAddr, rewardsAddr, poolPID) {
        pool = ICurvePoolUnderlying(poolAddr);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return pool.get_virtual_price();
    }

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amounts - amounts in stablecoins that user deposit
     */
    function deposit(uint256[3] memory amounts) external virtual onlyZunami returns (uint256) {
        uint256 _amountsTotal;
        for (uint256 i = 0; i < 3; i++) {
            _amountsTotal += amounts[i] * decimalsMultiplierS[i];
        }
        uint256 amountsMin = (_amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;
        uint256 lpPrice = pool.get_virtual_price();
        uint256 depositedLp = pool.calc_token_amount(amounts, true);
        if ((depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR < amountsMin) {
            return 0;
        }

        for (uint256 i = 0; i < 3; i++) {
            IERC20Metadata(_config.tokens[i]).safeIncreaseAllowance(address(pool), amounts[i]);
        }
        uint256 poolLPs = pool.add_liquidity(amounts, 0, true);

        poolLP.safeApprove(address(_config.booster), poolLPs);
        _config.booster.depositAll(cvxPoolPID, true);

        return (poolLPs * pool.get_virtual_price()) / CURVE_PRICE_DENOMINATOR;
    }

    /**
     * @dev Returns true if withdraw success and false if fail.
     * Withdraw failed when user depositedShare < crvRequiredLPs (wrong minAmounts)
     * @return Returns true if withdraw success and false if fail.
     * @param withdrawer - address of user that deposit funds
     * @param lpShares - amount of ZLP for withdraw
     * @param minAmounts -  array of amounts stablecoins that user want minimum receive
     */
    function withdraw(
        address withdrawer,
        uint256 lpShares,
        uint256 strategyLpShares,
        uint256[3] memory minAmounts
    ) external virtual onlyZunami returns (bool) {
        uint256 crvRequiredLPs = pool.calc_token_amount(minAmounts, false);
        uint256 depositedShare = (cvxRewards.balanceOf(address(this)) * lpShares) /
            strategyLpShares;

        if (depositedShare < crvRequiredLPs) {
            return false;
        }

        cvxRewards.withdrawAndUnwrap(depositedShare, true);
        sellCrvCvx();

        uint256[] memory userBalances = new uint256[](3);
        uint256[] memory prevBalances = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == ZUNAMI_USDT_TOKEN_ID) ? managementFees : 0;
            prevBalances[i] = IERC20Metadata(_config.tokens[i]).balanceOf(address(this));
            userBalances[i] = ((prevBalances[i] - managementFee) * lpShares) / strategyLpShares;
        }

        pool.remove_liquidity(depositedShare, minAmounts, true);

        for (uint256 i = 0; i < 3; i++) {
            IERC20Metadata(_config.tokens[i]).safeTransfer(
                withdrawer,
                IERC20Metadata(_config.tokens[i]).balanceOf(address(this)) -
                    prevBalances[i] +
                    userBalances[i]
            );
        }

        return true;
    }

    /**
     * @dev can be called by Zunami contract.
     * This function need for moveFunds between strategys.
     */
    function withdrawAll() external virtual onlyZunami {
        cvxRewards.withdrawAllAndUnwrap(true);
        sellCrvCvx();

        uint256 lpBalance = poolLP.balanceOf(address(this));
        uint256[3] memory minAmounts;
        pool.remove_liquidity(lpBalance, minAmounts, true);

        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == ZUNAMI_USDT_TOKEN_ID) ? managementFees : 0;
            IERC20Metadata(_config.tokens[i]).safeTransfer(
                _msgSender(),
                IERC20Metadata(_config.tokens[i]).balanceOf(address(this)) - managementFee
            );
        }
    }
}
