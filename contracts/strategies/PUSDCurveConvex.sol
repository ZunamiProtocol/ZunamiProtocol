//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract PUSDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_PUSD_ADDRESS,
            Constants.CRV_PUSD_LP_ADDRESS,
            Constants.CVX_PUSD_REWARDS_ADDRESS,
            Constants.CVX_PUSD_PID,
            Constants.PUSD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
