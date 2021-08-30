// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IUniswapV2Pair {
    function price0CumulativeLast() external view returns (uint256);

    function price1CumulativeLast() external view returns (uint256);
}
