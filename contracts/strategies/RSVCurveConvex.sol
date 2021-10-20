//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/Constants.sol";
import "./BaseCurveConvex2.sol";

contract RSVCurveConvex is BaseCurveConvex2 {
    constructor()
        BaseCurveConvex2(
            Constants.CRV_RSV_ADDRESS,
            Constants.CRV_RSV_LP_ADDRESS,
            Constants.CVX_RSV_REWARDS_ADDRESS,
            Constants.CRV_RSV_GAUGE_ADDRESS,
            Constants.CVX_RSV_PID,
            Constants.RSV_ADDRESS
        )
    {}
}
