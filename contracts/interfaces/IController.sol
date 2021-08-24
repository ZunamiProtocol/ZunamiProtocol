//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import './IStrategy.sol';

interface IController {
    function addStrategy(address strategyAddr, bytes32 strategyName) external;

    function removeStrategy(bytes32 strategyName) external;

    function addInsurance(address insuranceAddr, bytes32 insuranceName) external;

    function removeInsurance(bytes32 insuranceName) external;

    function getOptimalStrategy() external returns (IStrategy optimalStrategy);
}
