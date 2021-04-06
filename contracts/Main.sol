//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ZunamiStablecoin.sol";

contract Main {
    address constant internal usdcAddr = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant internal usdtAddr = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    bytes32 constant internal usdcTicker = 'usdc';
    bytes32 constant internal usdtTicker = 'usdt';
    bytes32 constant internal zusdTicker = 'zusd';

    struct Token {
        bytes32 ticker;
        IERC20 token;
    }

    mapping(bytes32 => Token) public stableCoins;
    mapping(address => mapping(bytes32 => uint)) public traderBalances;

    address public admin;

    constructor() {
        admin = msg.sender;
        stableCoins[usdcTicker] = Token(usdcTicker, IERC20(usdcAddr));
        stableCoins[usdtTicker] = Token(usdtTicker, IERC20(usdtAddr));
        stableCoins[zusdTicker] = Token(zusdTicker, new ZunamiStablecoin(address(this)));
    }

    function deposit(bytes32 ticker, uint amount) external {}

    function withdraw(bytes32 ticker, uint amount) external {}
}

