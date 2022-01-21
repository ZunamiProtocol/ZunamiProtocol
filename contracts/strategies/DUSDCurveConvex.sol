//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '../utils/Constants.sol';
import "./CurveConvexStrat2.sol";

contract DUSDCurveConvex is CurveConvexStrat2 {
    constructor()
    CurveConvexStrat2(
            Constants.CRV_DUSD_ADDRESS,
            Constants.CRV_DUSD_LP_ADDRESS,
            Constants.CVX_DUSD_REWARDS_ADDRESS,
            Constants.CVX_DUSD_PID,
            Constants.DUSD_ADDRESS,
            Constants.CVX_DUSD_EXTRA_ADDRESS,
            Constants.DUSD_EXTRA_ADDRESS,
            Constants.DUSD_EXTRA_PAIR_ADDRESS
        )
    {}
}
