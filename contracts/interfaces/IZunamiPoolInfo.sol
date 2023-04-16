//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './IStrategy.sol';

interface IZunamiPoolInfo {
    struct PoolInfo {
        IStrategy strategy;
        uint256 startTime;
        uint256 lpShares;
        bool enabled;
    }

    function poolInfo(uint256 pid) external view returns (PoolInfo memory);

    function poolCount() external view returns (uint256);
}
