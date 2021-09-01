//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICurveAavePool {
    function underlying_coins(uint256 i) external returns (address);

    function underlying_coins() external returns (address[] memory);

    function add_liquidity(
        uint256[] calldata amounts,
        uint256 minMintAmount,
        bool useUnderlying
    ) external returns (uint256);

    function remove_liquidity(
        uint256[] calldata minAmounts,
        uint256 burnAmount,
        bool useUnderlying
    ) external returns (uint256[] memory);

    function calc_token_amount(uint256[] calldata amounts, bool isDeposit)
        external
        returns (uint256);

    function get_virtual_price() external returns (uint256);
}
