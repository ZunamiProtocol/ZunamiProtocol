//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract USDC is ERC20 {
    constructor() ERC20('Test USDC Stablecoin', 'USDC') {}

    function faucet(address payable _to, uint _amount) external {
        _mint(_to, _amount);
    }
}

