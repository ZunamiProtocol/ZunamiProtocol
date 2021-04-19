//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IZUN {
    function mint(address payable _address, uint256 _amount) external;
    function burn(address payable _address, uint256 _amount) external;
}
