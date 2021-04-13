//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IZUSD {
    function mint(address _address, uint256 _amount) external;
    function burn(address _address, uint256 _amount) external;
}
