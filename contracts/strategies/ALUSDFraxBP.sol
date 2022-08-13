//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../utils/Constants.sol';
import './CurveConvexFraxBasePool.sol';

contract ALUSDFraxBP is CurveConvexFraxBasePool {
    constructor(Config memory config)
        CurveConvexFraxBasePool(
            config,
            Constants.FRAXBP_ALUSD_ADDRESS,
            Constants.FRAXBP_ALUSD_LP_ADDRESS,
            Constants.FRAXBP_ALUSD_REWARDS_ADDRESS,
            Constants.FRAXBP_ALUSD_PID,
            Constants.ALUSD_ADDRESS,
            address(0),
            address(0)
        )
    {}
}
