//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './ZUN.sol';
import './IZUN.sol';

import './mocks/usdc.sol';

contract Main {
    address constant internal usdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant internal usdtAddr = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    bytes32 constant internal usdcTicker = 'usdc';
    bytes32 constant internal usdtTicker = 'usdt';

    struct Token {
        bytes32 ticker;
        IERC20 token;
    }

    mapping(bytes32 => Token) public stableCoins;
    mapping(address => mapping(bytes32 => uint)) public depositerBalances;
    IZUN zun;

    constructor() {
        //TODO: For release version
        //stableCoins[usdcTicker] = Token(usdcTicker, IERC20(usdcAddr));
        //stableCoins[usdtTicker] = Token(usdtTicker, IERC20(usdtAddr));

        stableCoins[usdcTicker] = Token(usdcTicker, new USDC());
        zun = IZUN(new ZUN(address(this)));
    }

    function deposit(address payable _depositer, uint _amount, bytes32 _ticker)
      payable external validTokens(_ticker) {
            depositerBalances[_depositer][_ticker] += _amount;
            zun.mint(_depositer, _amount);

            //TODO: Add functionality for Yern Finance
    }

    function withdraw(address payable _depositer, uint _amount, bytes32 _ticker)
       payable external validTokens(_ticker) {
            require(depositerBalances[_depositer][_ticker] >= _amount, 'insufficient funds');

            depositerBalances[_depositer][_ticker] -= _amount;
            zun.burn(_depositer, _amount);

            //TODO: Add functionality for Yern Finance
    }

    modifier validTokens(bytes32 _ticker) {
        require(_ticker == usdcTicker, 'Invalid ticker');
        _;
    }
}

