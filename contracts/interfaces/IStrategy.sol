//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IStrategy {
    function deposit(uint256[3] memory amounts) external returns(bool);

    function withdraw(
        address depositer,
        uint256 lpsShare,
        uint256[3] memory amounts
    ) external returns(bool);

    function withdrawAll() external;

    function totalHoldings() external view returns (uint256);

    function claimManagementFees() external;
}
