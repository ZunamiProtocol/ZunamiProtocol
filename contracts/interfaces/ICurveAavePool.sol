//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICurveAavePool {
    function add_liquidity(uint256[3] calldata _amounts, uint256 _minMintAmount,
                           bool _useUnderlying) external returns(uint lpTokenAmount);

    function remove_liquidity_imbalance(uint256[3] calldata _amounts, uint256 _maxBurnAmount,
                                        bool _useUnderlying) external returns(uint tokenAmount);

    function calc_token_amount(uint[3] calldata _amounts, bool _isDeposit)
                               external returns(uint tokenAmount);

    function remove_liquidity_one_coin(uint256 _amounts, int128 _numberOfCoin, uint256 _minAmount,
                               bool _useUnderlying) external returns(uint tokenAmount) ;
}
