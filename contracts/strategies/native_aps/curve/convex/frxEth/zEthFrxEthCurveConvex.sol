//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../../../../utils/Constants.sol';
import './FrxEthCurveConvexApsStratBase.sol';

contract zEthFrxEthCurveConvex is FrxEthCurveConvexApsStratBase {
    constructor(Config memory config)
        FrxEthCurveConvexApsStratBase(
            config,
            Constants.ZUNAMI_ETH_POOL_ADDRESS,
            Constants.ZUNAMI_ETH_STABLE_ADDRESS,
            Constants.CRV_FRXETH_ZETH_ADDRESS,
            Constants.CRV_FRXETH_ZETH_LP_ADDRESS,
            Constants.CVX_FRXETH_ZETH_REWARDS_ADDRESS,
            Constants.CVX_FRXETH_ZETH_PID,
            Constants.zETH_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
