//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Indicates which ERC20 is staked
enum StakedPositionType {
    Fidu,
    CurveLP
}

interface IStakingRewards {
    function stake(uint256 amount, StakedPositionType positionType) external returns (uint256);

    function unstake(uint256 tokenId, uint256 amount) external;

    function addToStake(uint256 tokenId, uint256 amount) external;

    function stakedBalanceOf(uint256 tokenId) external view returns (uint256);

    function accumulatedRewardsPerToken() external view returns (uint256);

    function claimableRewards(uint256 tokenId) external view returns (uint256 rewards);

    function getReward(uint256 tokenId) external;
}
