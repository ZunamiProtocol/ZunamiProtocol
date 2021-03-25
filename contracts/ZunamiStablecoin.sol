//SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ZunamiStablecoin is ERC20{
    constructor() ERC20('Zunami Stablecoin', 'ZUSD'){}

    function mint(address _address, uint256 _amount) external {
        _mint(_address, _amount);
    }

    function burn(address _address, uint256 _amount) external {
        _burn(_address, _amount);
    }

}