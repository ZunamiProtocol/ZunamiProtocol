//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/ICurveAavePool.sol';

contract Main {
    address constant internal usdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    bytes32 constant internal usdcTicker = 'usdc';
    bytes32 constant internal curveTicker = 'a3CRV';

    address constant internal aavePool = 0xDeBF20617708857ebe4F679508E7b7863a8A8EeE;
    using SafeERC20 for IERC20;
    ICurveAavePool curveAavePool;

    struct Token {
        bytes32 ticker;
        IERC20 token;
    }

    mapping(bytes32 => Token) public stableCoins;
    mapping(address => mapping(bytes32 => uint)) public depositerBalances;

    uint public balanceBefore;
    uint public balanceAfter;
    uint public depositAmount;

    constructor() {
        stableCoins[usdcTicker] = Token(usdcTicker, IERC20(usdcAddr));
    }

    receive () external payable {}


    function deposit(address _depositer, uint _amount, bytes32 _ticker)
      payable external validTokens(_ticker) {

            console.log(depositerBalances[_depositer][usdcTicker], '<= USDC amount 1');
            IERC20(usdcAddr).transferFrom(_depositer, address(this), _amount);
            console.log(depositerBalances[_depositer][usdcTicker], '<= USDC amount 2');

            IERC20(usdcAddr).safeApprove(aavePool, _amount);
            
            uint[3] memory coinAmounts;
            coinAmounts[0] = 0;
            coinAmounts[1] = _amount;
            coinAmounts[2] = 0;

            depositerBalances[_depositer][curveTicker] += ICurveAavePool(aavePool).add_liquidity(coinAmounts, 0, true);
            depositerBalances[_depositer][_ticker] += _amount;             
    }

    function withdraw(address _depositer, uint _amount, bytes32 _ticker)
       payable external validTokens(_ticker) {
            require(depositerBalances[_depositer][_ticker] >= _amount, 'insufficient funds');
            
            uint[3] memory coinAmounts;
            coinAmounts[0] = 0;
            coinAmounts[1] = _amount;
            coinAmounts[2] = 0;

            console.log(depositerBalances[_depositer][curveTicker], '<= lp before');
            uint lpTokenAmount = (_amount * 100 / depositerBalances[_depositer][usdcTicker]) * depositerBalances[_depositer][curveTicker];
            console.log(_amount / depositerBalances[_depositer][usdcTicker], '<= sum!');
            console.log(lpTokenAmount, 'lp after');
            ICurveAavePool(aavePool).remove_liquidity_imbalance(coinAmounts, lpTokenAmount, true);
            depositerBalances[_depositer][_ticker] -= _amount;
            console.log(depositerBalances[_depositer][curveTicker] > lpTokenAmount);
            depositerBalances[_depositer][curveTicker] -= lpTokenAmount / 100;
            console.log( depositerBalances[_depositer][curveTicker]);

    }

    modifier validTokens(bytes32 _ticker) {
        require(_ticker == usdcTicker, 'Invalid ticker');
        _;
    }
}

