//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IExchangeRateFeeder {
    event RateUpdated(
        address indexed _operator,
        address indexed _token,
        uint256 _before,
        uint256 _after,
        uint256 _updateCount
    );

    enum Status {
        NEUTRAL,
        RUNNING,
        STOPPED
    }

    struct Token {
        Status status;
        uint256 exchangeRate;
        uint256 period;
        uint256 weight;
        uint256 lastUpdatedAt;
    }

    function exchangeRateOf(address _token, bool _simulate) external view returns (uint256);

    function update(address _token) external;
}
