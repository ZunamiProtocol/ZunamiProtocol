//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './CurveConvexStrat2.sol';

contract MIMCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_MIM_ADDRESS,
            Constants.CRV_MIM_LP_ADDRESS,
            Constants.CVX_MIM_REWARDS_ADDRESS,
            Constants.CVX_MIM_PID,
            Constants.MIM_ADDRESS,
            Constants.CVX_MIM_EXTRA_ADDRESS,
            Constants.MIM_EXTRA_ADDRESS
        )
    {}
}
