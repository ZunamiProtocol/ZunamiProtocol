//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract BUSDV2CurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_BUSDV2_ADDRESS,
            Constants.CRV_BUSDV2_LP_ADDRESS,
            Constants.CVX_BUSDV2_REWARDS_ADDRESS,
            Constants.CVX_BUSDV2_PID,
            Constants.BUSD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
