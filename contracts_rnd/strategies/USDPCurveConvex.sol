//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../contracts/utils/Constants.sol';
import './CurveConvexStrat2.sol';

contract USDPCurveConvex is CurveConvexStrat2 {
    constructor(Config memory config)
        CurveConvexStrat2(
            config,
            Constants.CRV_USDP_ADDRESS,
            Constants.CRV_USDP_LP_ADDRESS,
            Constants.CVX_USDP_REWARDS_ADDRESS,
            Constants.CVX_USDP_PID,
            Constants.USDP_ADDRESS,
            Constants.CVX_USDP_EXTRA_ADDRESS,
            Constants.USDP_EXTRA_ADDRESS
        )
    {}
}
