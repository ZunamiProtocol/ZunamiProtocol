//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Main {
    address constant internal usdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    bytes32 constant internal usdcTicker = 'usdc';

    struct Token {
        bytes32 ticker;
        IERC20 token;
    }

    mapping(bytes32 => Token) public stableCoins;
    mapping(address => mapping(bytes32 => uint)) public depositerBalances;

    constructor() {
        stableCoins[usdcTicker] = Token(usdcTicker, IERC20(usdcAddr));
    }

    function deposit(address payable _depositer, uint _amount, bytes32 _ticker)
      payable external validTokens(_ticker) {
            depositerBalances[_depositer][_ticker] += _amount;
    }

    function withdraw(address payable _depositer, uint _amount, bytes32 _ticker)
       payable external validTokens(_ticker) {
            require(depositerBalances[_depositer][_ticker] >= _amount, 'insufficient funds');

            depositerBalances[_depositer][_ticker] -= _amount;
    }

    modifier validTokens(bytes32 _ticker) {
        require(_ticker == usdcTicker, 'Invalid ticker');
        _;
    }
}

