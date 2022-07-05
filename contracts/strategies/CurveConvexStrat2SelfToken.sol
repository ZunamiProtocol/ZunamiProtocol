//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './CurveConvexStrat2.sol';

contract CurveConvexStrat2SelfToken is CurveConvexStrat2 {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    constructor(
        Config memory config,
        address poolAddr,
        address poolLPAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexStrat2(
            config,
            poolAddr,
            poolLPAddr,
            rewardsAddr,
            poolPID,
            tokenAddr,
            extraRewardsAddr,
            extraTokenAddr
        )
    {}

    /**
     * @dev anyone can sell rewards, func do nothing if config crv&cvx balance is zero
     */
    function sellRewards() internal override {
        uint256 cvxBalance = _config.cvx.balanceOf(address(this));
        uint256 crvBalance = _config.crv.balanceOf(address(this));
        if (cvxBalance == 0 || crvBalance == 0) {
            return;
        }
        _config.cvx.safeApprove(address(_config.router), cvxBalance);
        _config.crv.safeApprove(address(_config.router), crvBalance);

        uint256 usdtBalanceBefore = _config.tokens[ZUNAMI_USDT_TOKEN_ID].balanceOf(address(this));

        _config.router.swapExactTokensForTokens(
            cvxBalance,
            0,
            _config.cvxToUsdtPath,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        _config.router.swapExactTokensForTokens(
            crvBalance,
            0,
            _config.crvToUsdtPath,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        sellToken();

        uint256 usdtBalanceAfter = _config.tokens[ZUNAMI_USDT_TOKEN_ID].balanceOf(address(this));

        managementFees += zunami.calcManagementFee(usdtBalanceAfter - usdtBalanceBefore);
        emit SoldRewards(cvxBalance, crvBalance, 0);
    }
}
