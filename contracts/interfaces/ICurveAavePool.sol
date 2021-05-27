//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICurveAavePool {
    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount,
                           bool use_underlying) external returns(uint);

    function remove_liquidity_imbalance(uint256[3] calldata amounts, uint256 max_burn_amount,
                                        bool use_underlying) external returns(uint);

    function calc_token_amount(uint[3] calldata amounts, bool isDeposit)
                               external returns(uint lpTokensAmount);

    function calc_withdraw_one_coin(uint256 _token_amount, int128 _token) 
                               external returns(uint256);
}
