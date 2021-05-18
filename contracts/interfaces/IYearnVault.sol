//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IYearnVault {
    function deposit(uint _amount) external;
    function withdraw(uint _shares) external;
}

