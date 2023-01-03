//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract DUSDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_DUSD_ADDRESS,
            Constants.CRV_DUSD_LP_ADDRESS,
            Constants.CVX_DUSD_REWARDS_ADDRESS,
            Constants.CVX_DUSD_PID,
            Constants.DUSD_ADDRESS,
            Constants.CVX_DUSD_EXTRA_ADDRESS,
            Constants.DUSD_EXTRA_ADDRESS
        )
    {}
}
