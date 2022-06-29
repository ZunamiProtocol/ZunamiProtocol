//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStabilityPool {
    function provideToSP(uint256 _amount, address _frontEndTag) external;
}
