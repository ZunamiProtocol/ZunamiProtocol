//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '../utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract FraxCurveConvex is CurveConvexStrat2 {
    constructor()
        CurveConvexStrat2(
            Constants.CRV_FRAX_ADDRESS,
            Constants.CRV_FRAX_LP_ADDRESS,
            Constants.CVX_FRAX_REWARDS_ADDRESS,
            Constants.CVX_FRAX_PID,
            Constants.FRAX_ADDRESS,
            Constants.CVX_FRAX_EXTRA_ADDRESS,
            Constants.FRAX_EXTRA_ADDRESS
        )
    {}
}
