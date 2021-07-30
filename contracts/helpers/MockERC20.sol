//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20 as OzERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockERC20 is OzERC20 {

    uint8 private _decimals;

  constructor(string memory name, string  memory symbol, uint8 decimals)
   public OzERC20(name, symbol) {
     _decimals = decimals;
  }
}
