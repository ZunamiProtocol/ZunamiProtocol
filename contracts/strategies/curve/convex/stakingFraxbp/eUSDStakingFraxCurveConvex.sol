//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../utils/Constants.sol';
import './StakingFraxCurveConvexStratBaseV2.sol';

contract eUSDStakingFraxCurveConvex is StakingFraxCurveConvexStratBaseV2 {
    constructor(Config memory config)
        StakingFraxCurveConvexStratBaseV2(
            config,
            Constants.FRAX_USDC_ADDRESS,
            Constants.FRAX_USDC_LP_ADDRESS,
            Constants.CRV_FRAX_eUSD_ADDRESS,
            Constants.CRV_FRAX_eUSD_LP_ADDRESS,
            Constants.CVX_FRAX_eUSD_PID // 44
        )
    {}
}
