//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import '../interfaces/IStrategy.sol';

contract StubStrategy is IStrategy {
    function deposit(
        address _depositer,
        uint256 daiAmount,
        uint256 usdcAmount,
        uint256 usdtAmount
    ) external override {}

    function withdraw(
        address _depositer,
        uint256 daiAmount,
        uint256 usdcAmount,
        uint256 usdtAmount
    ) external override {}

    function withdrawAll(address _depositer) external override {}
}
