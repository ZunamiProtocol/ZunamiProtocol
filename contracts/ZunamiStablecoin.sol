//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './IZUSD.sol';

contract ZUSD is ERC20, IZUSD {
    address public owner;

    constructor(address _owner) ERC20('Zunami Stablecoin', 'ZUSD') {
        owner = _owner;
    }

    function mint(address _address, uint256 _amount) onlyOwner() external override {
        _mint(_address, _amount);
        transfer(_address, _amount);
    }

    function burn(address _address, uint256 _amount) onlyOwner() external override {
        _burn(_address, _amount);
    }

    modifier onlyOwner () {
        require(msg.sender == owner, 'only owner');
        _;
    }

}
