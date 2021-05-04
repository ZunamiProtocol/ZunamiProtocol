//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICurveAavePool {
    function add_liquidity(uint256[3] calldata amounts,
                           uint256 min_mint_amount,
                           bool use_underlying) external returns(uint);

    function remove_liquidity_imbalance(uint256[3] calldata amounts,
                           uint256 max_burn_amount,
                           bool use_underlying) external;

   function remove_liquidity(uint256 max_burn_amount,
                           uint256[3] calldata amounts,
                           bool use_underlying) external;
}
