//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import './interfaces/IController.sol';

contract Controller is IController {
    function addStrategy(address strategyAddr, bytes32 strategyName) external override {
    }

    function removeStrategy(bytes32 strategyName) external override {
    }

    function addInsurance(address insuranceAddr, bytes32 insuranceName) external override {
    }

    function removeInsurance(bytes32 insuranceName) external override {
    }

    function getOptimalStrategy() external override returns(address optimalStrategy) {
        return address(0);
    }
}
