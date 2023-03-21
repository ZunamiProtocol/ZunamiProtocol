//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import "../../contracts/strategies/curve/convex/CurveConvexStrat2.sol";

contract FraxCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_FRAX_ADDRESS,
            Constants.CRV_FRAX_LP_ADDRESS,
            Constants.CVX_FRAX_REWARDS_ADDRESS,
            Constants.CVX_FRAX_PID,
            Constants.FRAX_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
