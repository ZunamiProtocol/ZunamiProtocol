//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract DolaCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_DOLA_ADDRESS,
            Constants.CRV_DOLA_LP_ADDRESS,
            Constants.CRV_DOLA_REWARDS_ADDRESS,
            Constants.CVX_DOLA_PID,
            Constants.DOLA_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
