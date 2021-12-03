//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/Constants.sol";
import "./BaseCurveConvex4.sol";

contract OUSDCurveConvex is BaseCurveConvex4 {
    constructor()
    // TODO: need check constants
    BaseCurveConvex4(
        Constants.CRV_OUSD_ADDRESS,
        Constants.CRV_OUSD_LP_ADDRESS,
        Constants.CVX_OUSD_REWARDS_ADDRESS,
        Constants.CVX_OUSD_PID,
        Constants.OUSD_ADDRESS,
        address(0),
        address(0),
        address(0)
    )
    {}
}
