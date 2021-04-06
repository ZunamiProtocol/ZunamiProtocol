//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ZunamiStablecoin is ERC20 {
    address public owner;

    constructor(address _owner) ERC20('Zunami Stablecoin', 'ZUSD') {
        owner = _owner;
    }

    function mint(address _address, uint256 _amount) onlyOwner() external {
        _mint(_address, _amount);
    }

    function burn(address _address, uint256 _amount) onlyOwner() external {
        _burn(_address, _amount);
    }

    modifier onlyOwner () {
        require(msg.sender == owner, 'only owner');
        _;
    }

}
