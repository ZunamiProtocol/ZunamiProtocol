//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import '../interfaces/IStrategy.sol';

contract MStableStrategy is IStrategy {
    function deposit(address _depositer, uint _amount, bytes32 _ticker) external override {

    }

    function withdraw(address _depositer, uint _amount, bytes32 _ticker) external override {

    }

    function withdrawAll(address _depositer, int128 _coin, uint _minAmount,
        bytes32 _ticker) external override {

    }
}
