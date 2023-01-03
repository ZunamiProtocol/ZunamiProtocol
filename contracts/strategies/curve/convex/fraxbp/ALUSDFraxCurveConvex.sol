//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../utils/Constants.sol';
import './FraxCurveConvexStratBase.sol';

contract ALUSDFraxCurveConvex is FraxCurveConvexStratBase {
    constructor(Config memory config)
        FraxCurveConvexStratBase(
            config,
            Constants.FRAX_USDC_ADDRESS,
            Constants.FRAX_USDC_LP_ADDRESS,
            Constants.CRV_FRAX_ALUSD_ADDRESS,
            Constants.CRV_FRAX_ALUSD_LP_ADDRESS,
            Constants.CVX_FRAX_ALUSD_REWARDS_ADDRESS,
            Constants.CVX_FRAX_ALUSD_PID,
            Constants.ALUSD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
