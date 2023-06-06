//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../../utils/Constants.sol';
import './StakingFraxEthCurveConvexStratBase.sol';

contract frxEthStakingFraxCurveConvex is StakingFraxEthCurveConvexStratBase {
    constructor(Config memory config)
        StakingFraxEthCurveConvexStratBase(
            config,
            Constants.ETH_frxETH_ADDRESS,
            Constants.ETH_frxETH_LP_ADDRESS,
            Constants.CVX_ETH_frxETH_PID // 36
        )
    {}
}
