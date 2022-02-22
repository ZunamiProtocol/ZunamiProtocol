//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './ICurvePoolPricable.sol';

interface ICurvePool is ICurvePoolPricable {
    function add_liquidity(
        uint256[3] memory amounts,
        uint256 minMintAmount
    ) external;

    function remove_liquidity(
        uint256 burnAmount,
        uint256[3] memory minAmounts
    ) external;

    function exchange(
        int128 i,
        int128 j,
        uint256 input,
        uint256 minOutput
    ) external;

    function calc_token_amount(
        uint256[3] memory amounts,
        bool isDeposit
    ) external view returns (uint256);
}
