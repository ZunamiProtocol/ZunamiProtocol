//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IConvex {
  function rewardRate() external view returns (uint);

  function totalSupply() external view returns (uint);
}
