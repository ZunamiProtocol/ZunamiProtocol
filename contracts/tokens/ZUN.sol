// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ZUN is ERC20 {
    constructor() ERC20('Zunami token', 'ZUN') {
        _mint(msg.sender, 100_000_000 * 1e18);
    }
}
