//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ICurvePool4 {
    function underlying_coins(uint256 i) external view returns (address);

    function underlying_coins() external view returns (address[] memory);

    function add_liquidity(
        uint256[4] memory amounts,
        uint256 minMintAmount,
        bool useUnderlying
    ) external returns (uint256);

    function A() external view returns (uint256);

    function balances(uint256 i) external view returns (uint256);

    function remove_liquidity(
        uint256 burnAmount,
        uint256[4] memory minAmounts,
        bool useUnderlying
    ) external returns (uint256[4] memory);

    function calc_token_amount(uint256[4] memory amounts, bool isDeposit)
        external
        view
        returns (uint256);

    function get_virtual_price() external view returns (uint256);
}
