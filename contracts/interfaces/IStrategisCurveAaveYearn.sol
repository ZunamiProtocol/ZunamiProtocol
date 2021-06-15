//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IStrategisCurveAaveYearn {
    function deposit(address _depositer, uint _amount, bytes32 _ticker) external;

    function pickUpQuantityTokens(address _depositer, uint _amount, bytes32 _ticker) external;

    function withdrawAll(address _depositer, int128 _coin, uint _min_amount,
        bytes32 _ticker) external;
}
