//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './CurveConvexStrat2.sol';

contract LUSDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_LUSD_ADDRESS,
            Constants.CRV_LUSD_LP_ADDRESS,
            Constants.CVX_LUSD_REWARDS_ADDRESS,
            Constants.CVX_LUSD_PID,
            Constants.LUSD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
