//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../contracts/utils/Constants.sol';
import './CurveConvexStrat4.sol';

contract SUSDCurveConvex is CurveConvexStrat4 {
    constructor(Config memory config)
        CurveConvexStrat4(
            config,
            Constants.CRV_SUSD_ADDRESS,
            Constants.CRV_SUSD_LP_ADDRESS,
            Constants.CVX_SUSD_REWARDS_ADDRESS,
            Constants.CVX_SUSD_PID,
            Constants.SUSD_ADDRESS,
            Constants.CVX_SUSD_EXTRA_ADDRESS,
            Constants.SUSD_EXTRA_ADDRESS
        )
    {}
}
