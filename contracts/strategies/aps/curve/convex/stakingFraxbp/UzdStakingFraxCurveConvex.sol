//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../../utils/Constants.sol';
import './StakingFraxCurveConvexApsStratBase.sol';

contract UzdStakingFraxCurveConvex is StakingFraxCurveConvexApsStratBase {
    constructor(Config memory config)
        StakingFraxCurveConvexApsStratBase(
            config,
            Constants.FRAX_USDC_ADDRESS,
            Constants.FRAX_USDC_LP_ADDRESS,
            Constants.CRV_FRAX_UZD_ADDRESS,
            Constants.CRV_FRAX_UZD_LP_ADDRESS,
            Constants.CVX_FRAX_STAKED_UZD_PID // 47
        )
    {}
}
