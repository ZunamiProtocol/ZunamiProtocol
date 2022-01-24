//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract RSVCurveConvex is CurveConvexStrat2 {
    constructor()
        CurveConvexStrat2(
            Constants.CRV_RSV_ADDRESS,
            Constants.CRV_RSV_LP_ADDRESS,
            Constants.CVX_RSV_REWARDS_ADDRESS,
            Constants.CVX_RSV_PID,
            Constants.RSV_ADDRESS,
            Constants.CVX_RSV_EXTRA_ADDRESS,
            Constants.RSV_EXTRA_ADDRESS,
            Constants.RSV_EXTRA_PAIR_ADDRESS
        )
    {}
}
