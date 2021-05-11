//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IYearnVault {
    function deposit(uint _amount) public;
    function withdraw(uint _shares) public
}

