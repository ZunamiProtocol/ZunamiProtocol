//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract USDC is ERC20 {
    constructor() ERC20('USDC Stable Coin', 'USDC') {}

    function faucet(address to, uint amount) external {
        _mint(to, amount);
    }
}
