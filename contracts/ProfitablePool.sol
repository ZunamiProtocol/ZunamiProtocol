//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IConvex.sol';
import './interfaces/ICurveAavePool.sol';

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
      virtualPrice = ICurveAavePool(curve).get_virtual_price();

      rewards = type(uint).max * rewardRate / totalSupply / virtualPrice;
      if (rewards > maxValue) {
        maxValue = rewards;
        maxIndex = i;
      }
    }

    return convex[maxIndex];
  }

  function setProfitableAddress(address _profitablePoolAddress) external {
    profitablePoolAddress = _profitablePoolAddress;
  }
}

