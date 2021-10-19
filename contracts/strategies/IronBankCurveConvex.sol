//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/Constants.sol";
import "./BaseCurveConvex.sol";

contract IronBankCurveConvex is BaseCurveConvex {
    constructor()
        BaseCurveConvex(
            Constants.CRV_IRONBANK_ADDRESS,
            Constants.CRV_IRONBANK_LP_ADDRESS,
            Constants.CVX_IRONBANK_REWARDS_ADDRESS,
            Constants.CRV_IRONBANK_GAUGE_ADDRESS,
            Constants.CVX_IRONBANK_PID
        )
    {}
}
