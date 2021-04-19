//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './IZUN.sol';

contract ZUN is ERC20, IZUN 
{
    address public owner;

    constructor(address _owner) ERC20('Zunami Coin', 'ZUN') {
        owner = _owner;
    }

    function mint(address payable _address, uint256 _amount) onlyOwner() external override {
        _mint(_address, _amount);
    }

    function burn(address payable _address, uint256 _amount) onlyOwner() external override {
        _burn(_address, _amount);
    }

    modifier onlyOwner () {
        require(msg.sender == owner, 'only owner');
        _;
    }

}
