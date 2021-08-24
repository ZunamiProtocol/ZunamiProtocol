//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IStrategy {
    function deposit(
        address _depositer,
        uint256 daiAmount,
        uint256 usdcAmount,
        uint256 usdtAmount
    ) external;

    function withdraw(
        address _depositer,
        uint256 daiAmount,
        uint256 usdcAmount,
        uint256 usdtAmount
    ) external;

    function withdrawAll(address _depositer) external;
}
