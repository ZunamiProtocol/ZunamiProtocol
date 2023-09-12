//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./FraxCurveConcentratorApsStrat.sol";

contract UzdFraxCurveConcentrator is FraxCurveConcentratorApsStrat {
    constructor(Config memory config)
    FraxCurveConcentratorApsStrat(
            config,
            Constants.ZUNAMI_POOL_ADDRESS,
            Constants.ZUNAMI_STABLE_ADDRESS,
            Constants.FRAX_USDC_ADDRESS,
            Constants.FRAX_USDC_LP_ADDRESS,
            Constants.CRV_FRAX_UZD_ADDRESS,
            Constants.CRV_FRAX_UZD_LP_ADDRESS,
            Constants.CONCENTRATOR_UZD_VAULT_ADDRESS,
            Constants.CONCENTRATOR_UZD_VAULT_PID,
            Constants.UZD_ADDRESS
        )
    {}
}
