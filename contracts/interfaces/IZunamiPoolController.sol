//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IStrategy.sol';
import './IZunamiPoolInfo.sol';

interface IZunamiPoolController is IZunamiPoolInfo {
    function increasePoolShares(uint256 pid, uint256 amount) external;

    function decreasePoolShares(uint256 pid, uint256 amount) external;

    function calcTokenPrice(uint256 holdings, uint256 tokens) external pure returns (uint256);

    //ERC20
    function totalSupply() external view returns (uint256);
}
