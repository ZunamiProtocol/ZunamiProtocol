//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import {IERC20 as OzIERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20 as OzSafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AddressAndTickers as Constant} from '../helpers/AddressAndTickers.sol';

import '../interfaces/IStrategy.sol';
import '../interfaces/ICurveAavePool.sol';
import '../interfaces/IYearnAlusd.sol';

import "hardhat/console.sol";

contract StrategyYearnAlusd is IStrategy {

    using OzSafeERC20 for OzIERC20;

    struct Token {
        bytes32 ticker;
        OzIERC20 token;
    }

    mapping(bytes32 => Token) public Coins;
    mapping(address => mapping(bytes32 => uint)) public depositerBalances;

    ICurveAavePool aavePool;
    IYearnAlusd yearnVault;

    constructor() {
        Coins[Constant.USDC_TICKER] = Token(Constant.USDC_TICKER, OzIERC20(Constant.USDC_ADDRESS));
        Coins[Constant.CURVE_TICKER] = Token(Constant.CURVE_TICKER, OzIERC20(Constant.CURVE_TOKEN_ADDRESS));
        Coins[Constant.YEARN_TICKER] = Token(Constant.YEARN_TICKER, OzIERC20(Constant.YEARN_TOKEN_ADDRESS));

        aavePool = ICurveAavePool(Constant.CURVE_AAVE_ADDRESS);
        yearnVault = IYearnAlusd(Constant.YEARN_VAULT_ADDRESS);
    }

    function deposit(address _depositer, uint _amount, bytes32 _ticker) external override {
        require(Coins[Constant.USDC_TICKER].token.balanceOf(_depositer) >= _amount,
                'Insufficent balance of the depositer');

        Coins[Constant.USDC_TICKER].token.transferFrom(_depositer, address(this), _amount);
        Coins[Constant.USDC_TICKER].token.safeApprove(Constant.CURVE_AAVE_ADDRESS, _amount);

        uint curveTokenAmount = _depositToCurve({
            _depositer: _depositer, _amount: _amount, _ticker: _ticker
            });
        _depositToYearn({_depositer: _depositer, _amount: curveTokenAmount});
    }

    function _depositToCurve(address _depositer, uint _amount, bytes32 _ticker)
        internal returns(uint curveTokensAmount) {

        uint[3] memory coinAmounts;
        coinAmounts[0] = 0;
        coinAmounts[1] = _amount;
        coinAmounts[2] = 0;

        uint curveTokenAmount = aavePool.add_liquidity(coinAmounts, 0, true);
        depositerBalances[_depositer][_ticker] += _amount;
        depositerBalances[_depositer][Constant.CURVE_TICKER] += curveTokenAmount;

        return curveTokenAmount;
    }

    function _depositToYearn(address _depositer, uint _amount) internal {
        Coins[Constant.CURVE_TICKER].token.safeApprove(Constant.YEARN_VAULT_ADDRESS, _amount);

        uint yearnTokenAmountBefore = yearnVault.balanceOf(address(this));
        yearnVault.deposit(_amount);
        uint yearnTokenAmount = yearnVault.balanceOf(address(this)) - yearnTokenAmountBefore;

        depositerBalances[_depositer][Constant.YEARN_TICKER] += yearnTokenAmount;
    }

    function withdrawAll(address _depositer, int128 _coin, uint _minAmount,
        bytes32 _ticker) external override {
        require(depositerBalances[ _depositer][_ticker] > 0,
                "Insufficient funds for withdrawAll");

        uint curveTokenAmount = _withdrawFromYearn({
             _depositer: _depositer, _amount: depositerBalances[ _depositer][Constant.YEARN_TICKER]});

        uint amount = aavePool.remove_liquidity_one_coin(curveTokenAmount, _coin, _minAmount, true);
        depositerBalances[_depositer][Constant.CURVE_TICKER] = 0;

        Coins[Constant.USDC_TICKER].token.transfer(_depositer, amount);
        depositerBalances[_depositer][_ticker] = 0;

    }

    function withdraw(address _depositer, uint _amount, bytes32 _ticker) external override {
        require(depositerBalances[_depositer][_ticker] >= _amount,
                "Insufficient funds for withdraw");

        uint[3] memory coinAmounts;
        coinAmounts[0] = 0;
        coinAmounts[1] = _amount;
        coinAmounts[2] = 0;

        uint curveRequiredAmount = aavePool.calc_token_amount(coinAmounts, false);
        uint curveTokenAmount = _withdrawFromYearn({
            _depositer: _depositer, _amount: curveRequiredAmount
            });

        _withdrawFromCurve({
            _depositer: _depositer, _amount: coinAmounts, curveTokenAmount: curveTokenAmount
            });

        Coins[Constant.USDC_TICKER].token.transfer(_depositer, _amount);
        depositerBalances[_depositer][_ticker] -= _amount;
    }

    function _withdrawFromCurve(address _depositer, uint[3] memory _amount, uint curveTokenAmount)
        internal {

        aavePool.remove_liquidity_imbalance(_amount, curveTokenAmount, true);
        depositerBalances[_depositer][Constant.CURVE_TICKER] -= curveTokenAmount;
    }

    function _withdrawFromYearn(address _depositer, uint _amount)
        internal returns(uint curveTokenAmount) {
        require(depositerBalances[_depositer][Constant.YEARN_TICKER] >= _amount,
                "Insufficient funds for Yearn");

        uint curveTokensBefore = Coins[Constant.CURVE_TICKER].token.balanceOf(address(this));
        yearnVault.withdraw(_amount);
        uint curveTokensAfter = Coins[Constant.CURVE_TICKER].token.balanceOf(address(this));

        depositerBalances[_depositer][Constant.YEARN_TICKER] -= _amount;

        return curveTokensAfter - curveTokensBefore;
    }

}
