//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IConvex {
  function rewardRate() external view returns (uint);
  function totalSupply() external view returns (uint);
}

interface ICurve {
  function get_virtual_price() external view returns (uint);
}

contract ProfitablePool {
  address public profitablePoolAddress;
  function getProfitablePool(address[] calldata convex, address curve) external view returns (address) {
    uint maxValue = 0;
    uint maxIndex = 0;
    uint rewardRate;
    uint totalSupply;
    uint virtualPrice;
    uint rewards;

    for (uint i = 0; i < convex.length; i++) {
      rewardRate = IConvex(convex[i]).rewardRate();
      totalSupply = IConvex(convex[i]).totalSupply();
      virtualPrice = ICurve(curve).get_virtual_price();
      rewards = totalSupply * virtualPrice / rewardRate;
      rewards = type(uint).max / rewards;
      if (rewards > maxValue) {
        maxValue = rewards;
        maxIndex = i;
      }
    }

    return convex[maxIndex];
  }
}

function setProfitableAddress(address _profitablePoolAddress) external {
  profitablePoolAddress = _profitablePoolAddress;
}