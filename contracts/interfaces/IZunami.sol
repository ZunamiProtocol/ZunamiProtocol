//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IZunami {
    function lpSupply() external returns (uint256);

    function totalDeposited() external returns (uint256);

    function getTotalValue() external returns (uint256);

    function calculateFee(uint256 amount) external returns (uint256);
}
