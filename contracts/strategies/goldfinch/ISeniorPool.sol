//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISeniorPool {
    function sharePrice() external view returns (uint256);
    function deposit(uint256 amount) external returns (uint256 depositShares);
    function withdrawInFidu(uint256 fiduAmount) external returns (uint256 amount);
    // Converts USDC amount to FIDU amount
    function getNumShares(uint256 amount) external view returns (uint256);
}
