//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract RSVCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_RSV_ADDRESS,
            Constants.CRV_RSV_LP_ADDRESS,
            Constants.CVX_RSV_REWARDS_ADDRESS,
            Constants.CVX_RSV_PID,
            Constants.RSV_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
