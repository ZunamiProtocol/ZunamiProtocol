//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract MUSDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_MUSD_ADDRESS,
            Constants.CRV_MUSD_LP_ADDRESS,
            Constants.CVX_MUSD_REWARDS_ADDRESS,
            Constants.CVX_MUSD_PID,
            Constants.MUSD_ADDRESS,
            Constants.CVX_MUSD_EXTRA_ADDRESS,
            Constants.MUSD_EXTRA_ADDRESS
        )
    {}
}
