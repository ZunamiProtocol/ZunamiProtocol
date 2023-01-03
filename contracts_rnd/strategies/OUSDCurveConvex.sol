//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract OUSDCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_OUSD_ADDRESS,
            Constants.CRV_OUSD_LP_ADDRESS,
            Constants.CVX_OUSD_REWARDS_ADDRESS,
            Constants.CVX_OUSD_PID,
            Constants.OUSD_ADDRESS,
            Constants.CRV_OUSD_EXTRA_ADDRESS,
            Constants.OUSD_EXTRA_ADDRESS
        )
    {}
}
