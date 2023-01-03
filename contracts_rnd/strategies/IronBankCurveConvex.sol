//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat.sol';

contract IronBankCurveConvex is CurveConvexStrat {
    constructor(Config memory config)
        CurveConvexStrat(
            config,
            Constants.CRV_IRONBANK_ADDRESS,
            Constants.CRV_IRONBANK_LP_ADDRESS,
            Constants.CVX_IRONBANK_REWARDS_ADDRESS,
            Constants.CVX_IRONBANK_PID
        )
    {}
}
