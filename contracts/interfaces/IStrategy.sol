//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IStrategy {
    function deposit(uint256[] calldata amounts) external;

    function withdraw(
        address depositer,
        uint256 lpsShare,
        uint256 totalSupply,
        uint256[] calldata amounts
    ) external;

    function withdrawAll() external;

    function getTotalValue() external returns (uint256);
}
