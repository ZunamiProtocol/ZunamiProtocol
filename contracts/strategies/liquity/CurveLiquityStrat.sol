//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../../utils/Constants.sol';
import './LiquityConstants.sol';
import './CurveLiquityStratBase.sol';

contract CurveLiquityStrat is CurveLiquityStratBase {
    constructor(Config memory config)
        CurveLiquityStratBase(
            config,
            Constants.CRV_3POOL_ADDRESS,
            Constants.CRV_3POOL_LP_ADDRESS,
            Constants.CRV_LUSD_ADDRESS,
            Constants.LUSD_ADDRESS,
            LiquityConstants.STABILITY_POOL,
            LiquityConstants.LQTY_TOKEN
        )
    {}
}
