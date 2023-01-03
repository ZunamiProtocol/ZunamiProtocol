//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat.sol';

contract AaveCurveConvex is CurveConvexStrat {
    constructor(Config memory config)
        CurveConvexStrat(
            config,
            Constants.CRV_AAVE_ADDRESS,
            Constants.CRV_AAVE_LP_ADDRESS,
            Constants.CVX_AAVE_REWARDS_ADDRESS,
            Constants.CVX_AAVE_PID
        )
    {}
}
