//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IStrategy {
    function deposit(uint256[3] memory amounts) external;

    function withdraw(
        address depositer,
        uint256 lpsShare,
        uint256[3] memory amounts
    ) external;

    function withdrawAll() external;

    function getTotalValue() external view returns (uint256);

    function claimProfit() external;
}
