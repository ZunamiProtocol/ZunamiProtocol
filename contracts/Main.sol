//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/ICurveAavePool.sol';

contract Main {
    address constant internal usdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    bytes32 constant internal usdcTicker = 'usdc';

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
            depositerBalances[_depositer][_ticker] += _amount;
              
            IERC20(usdcAddr).safeApprove(aavePool, 0);
            IERC20(usdcAddr).safeApprove(aavePool, _amount);
            
            uint[3] memory coinAmounts;
            coinAmounts[0] = 0;
            coinAmounts[1] = _amount;
            coinAmounts[2] = 0;

            ICurveAavePool(aavePool).add_liquidity(coinAmounts, 0, true);
    }

    function withdraw(address _depositer, uint _amount, bytes32 _ticker)
       payable external validTokens(_ticker) {
            require(depositerBalances[_depositer][_ticker] >= _amount, 'insufficient funds');

            uint[3] memory coinAmounts;
            coinAmounts[0] = 0;
            coinAmounts[1] = _amount;
            coinAmounts[2] = 0;

            depositerBalances[_depositer][_ticker] -= _amount;
            ICurveAavePool(aavePool).remove_liquidity_imbalance(coinAmounts, _amount, true);
    }

    modifier validTokens(bytes32 _ticker) {
        require(_ticker == usdcTicker, 'Invalid ticker');
        _;
    }
}

