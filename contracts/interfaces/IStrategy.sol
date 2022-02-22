//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStrategy {
    function deposit(uint256[3] memory amounts) external returns (uint256);

    function withdraw(
        address withdrawer,
        uint256 lpShare,
        uint256 strategyLpShare,
        uint256[3] memory amounts
    ) external returns (bool);

    function withdrawAll() external;

    function totalHoldings() external view returns (uint256);

    function claimManagementFees() external;
}
