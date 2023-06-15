//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../../utils/Constants.sol';
import './FrxEthCurveConvexStratBase.sol';

contract stEthFraxEthCurveConvex is FrxEthCurveConvexStratBase {
    constructor(Config memory config)
        FrxEthCurveConvexStratBase(
            config,
            Constants.CRV_FRAX_stETH_ADDRESS,
            Constants.CRV_FRAX_stETH_LP_ADDRESS,
            Constants.CVX_FRAX_stETH_REWARDS_ADDRESS,
            Constants.CVX_FRAX_stETH_PID
        )
    {}
}
