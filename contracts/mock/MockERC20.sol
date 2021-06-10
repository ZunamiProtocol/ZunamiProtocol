//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockERC20 is ERC20 {

    uint8 private _decimals;

  constructor(string memory _name, string  memory _symbol, uint8 _decimals)
   public ERC20(_name, _symbol) {
     _decimals = _decimals;
  }
}
