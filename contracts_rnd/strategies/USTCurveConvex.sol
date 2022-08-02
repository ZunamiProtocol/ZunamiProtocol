// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract USTWormholeCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_UST_WORMHOLE_ADDRESS,
            Constants.CRV_UST_WORMHOLE_LP_ADDRESS,
            Constants.CVX_UST_WORMHOLE_REWARDS_ADDRESS,
            Constants.CVX_UST_PID,
            Constants.UST_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
