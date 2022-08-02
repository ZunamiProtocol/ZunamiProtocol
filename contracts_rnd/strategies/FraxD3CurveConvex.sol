//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './D3CurveConvexStrat.sol';

contract FraxD3CurveConvex is D3CurveConvexStrat {
    constructor(Config memory config)
    D3CurveConvexStrat(
            config,
            Constants.CRV_3POOL_ADDRESS,
            Constants.CRV_3POOL_LP_ADDRESS,
            Constants.CRV_FRAX_ADDRESS,
            Constants.FRAX_ADDRESS,
            Constants.CRV_D3_ADDRESS,
            Constants.CRV_D3_LP_ADDRESS
        )
    {}
}
