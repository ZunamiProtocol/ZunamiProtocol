//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import './interfaces/IController.sol';
import './interfaces/IStrategy.sol';

contract Controller is IController {
    function addStrategy(address strategyAddr, bytes32 strategyName) external override {}

    function removeStrategy(bytes32 strategyName) external override {}

    function addInsurance(address insuranceAddr, bytes32 insuranceName) external override {}

    function removeInsurance(bytes32 insuranceName) external override {}

    function getOptimalStrategy() external pure override returns (IStrategy optimalStrategy) {
        return IStrategy(address(0));
    }
}
