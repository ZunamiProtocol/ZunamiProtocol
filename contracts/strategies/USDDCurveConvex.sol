//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract USDDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_USDD_ADDRESS,
            Constants.CRV_USDD_LP_ADDRESS,
            Constants.CVX_USDD_REWARDS_ADDRESS,
            Constants.CVX_USDD_PID,
            Constants.USDD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
