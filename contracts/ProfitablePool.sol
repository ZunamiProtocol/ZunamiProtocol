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
  function getProfitablePool(address[] calldata convex, address curve) public view returns(uint[] memory rewards) {
    rewards = new uint[](convex.length);
    uint rewardRate;
    uint totalSupply;
    uint virtualPrice;
    uint reward;

    for (uint i = 0; i < convex.length; i++) {
      rewardRate = IConvex(convex[i]).rewardRate();
      totalSupply = IConvex(convex[i]).totalSupply();
      virtualPrice = ICurve(curve).get_virtual_price();
      reward = rewardRate * (10 ** 40) / totalSupply / virtualPrice;
      rewards[i] = reward;
    }
  }
}