//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IStrategis {
    function deposit(address _depositer, uint _amount, bytes32 _ticker) external;

    function withdraw(address _depositer, uint _amount, bytes32 _ticker) external;

    function withdrawAll(address _depositer, int128 _coin, uint _minAmount,
        bytes32 _ticker) external;
}
