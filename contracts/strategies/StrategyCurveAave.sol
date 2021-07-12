//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import {IERC20 as OzIERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20 as OzSafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AddressAndTickers as Constant} from '../helpers/AddressAndTickers.sol';

import '../interfaces/IStrategy.sol';
import '../interfaces/ICurveAavePool.sol';

import "hardhat/console.sol";

contract StrategyCurveAave is IStrategy {
 
    using OzSafeERC20 for OzIERC20;

    struct Token {
        bytes32 ticker;
        OzIERC20 token;
    }

    mapping(bytes32 => Token) public Coins;
    mapping(address => mapping(bytes32 => uint)) public depositerBalances;

    ICurveAavePool aavePool;

    constructor() {
        Coins[Constant.USDC_TICKER] = Token(Constant.USDC_TICKER, OzIERC20(Constant.USDC_ADDRESS));
        Coins[Constant.CURVE_TICKER] = Token(Constant.CURVE_TICKER, OzIERC20(Constant.CURVE_TOKEN_ADDRESS));

        aavePool = ICurveAavePool(Constant.CURVE_AAVE_ADDRESS);
    }

    function deposit(address _depositer, uint _amount, bytes32 _ticker) external override {
        require(Coins[Constant.USDC_TICKER].token.balanceOf(_depositer) >= _amount,
                'Insufficent balance of the depositer');

        Coins[Constant.USDC_TICKER].token.safeApprove(Constant.CURVE_AAVE_ADDRESS, _amount);

        uint[3] memory coinAmounts;
        coinAmounts[0] = 0;
        coinAmounts[1] = _amount;
        coinAmounts[2] = 0;

        uint curveTokenAmount = aavePool.add_liquidity(coinAmounts, 0, true);
        depositerBalances[_depositer][_ticker] += _amount;
        depositerBalances[_depositer][Constant.CURVE_TICKER] += curveTokenAmount;
    }

     function withdraw(address _depositer, uint _amount,
         bytes32 _ticker) external override {
         require(depositerBalances[_depositer][_ticker] >= _amount,
                "Insufficient funds for withdraw");

        uint[3] memory coinAmounts;
        coinAmounts[0] = 0;
        coinAmounts[1] = _amount;
        coinAmounts[2] = 0;

        uint curveRequiredAmount = aavePool.calc_token_amount(coinAmounts, false);

        uint curveTokenAmount = aavePool.
            remove_liquidity_imbalance(coinAmounts, curveRequiredAmount, true);

        depositerBalances[_depositer][Constant.CURVE_TICKER] -= curveTokenAmount;

        Coins[Constant.USDC_TICKER].token.transfer(_depositer, _amount);
        depositerBalances[_depositer][_ticker] -= _amount;
     }


    function withdrawAll(address _depositer, int128 _coin, uint _minAmount,
        bytes32 _ticker) external override {
        require(depositerBalances[ _depositer][_ticker] > 0,
            "Insufficient funds for withdrawAll");

        uint amount = aavePool.remove_liquidity_one_coin(
            depositerBalances[_depositer][Constant.CURVE_TICKER]
            , _coin, _minAmount, true);

        depositerBalances[_depositer][Constant.CURVE_TICKER] = 0;
        Coins[Constant.USDC_TICKER].token.transfer(_depositer, amount);
        depositerBalances[_depositer][_ticker] = 0;
    }

}
