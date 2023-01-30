//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './CurveConvexStrat2.sol';

contract CurveConvexStrat2Self is CurveConvexStrat2 {
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

    function sellRewardsExtra() internal virtual override {
        super.sellRewardsExtra();
        sellToken();
    }
}
