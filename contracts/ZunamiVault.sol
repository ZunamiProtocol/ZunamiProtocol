//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import 'hardhat/console.sol';

import { AddressAndTickers as Constants } from './helpers/AddressAndTickers.sol';

contract ZunamiVault is ERC20 {
    IERC20 immutable dai;
    IERC20 immutable usdc;
    IERC20 immutable usdt;

    constructor() ERC20('zunamiLP', 'zlpt') {
        dai = IERC20(Constants.DAI_ADDRESS);
        usdc = IERC20(Constants.USDC_ADDRESS);
        usdt = IERC20(Constants.USDT_ADDRESS);
    }

    function deposit(
        uint256 amountOfDAI,
        uint256 amountOfUSDC,
        uint256 amountOfUSDT
    ) external {
        require(dai.balanceOf(msg.sender) >= amountOfDAI, 'Insufficient funds');
        require(usdc.balanceOf(msg.sender) >= amountOfUSDC, 'Insufficient funds');
        require(usdt.balanceOf(msg.sender) >= amountOfUSDT, 'Insufficient funds');

        uint256 totalStablecoinsAmount = amountOfDAI + amountOfUSDC + amountOfUSDT;

        dai.transferFrom(msg.sender, address(this), amountOfDAI);
        usdc.transferFrom(msg.sender, address(this), amountOfUSDC);
        usdt.transferFrom(msg.sender, address(this), amountOfUSDT);

        uint256 shares = 0;
        uint256 totalSupply = totalSupply();
        uint256 totalStablecoinsInPool = _totalDepositedStablecoins();

        if (totalSupply == 0) {
            shares = totalStablecoinsAmount;
        } else {
            shares = (totalStablecoinsAmount * totalSupply) / totalStablecoinsInPool;
        }

        _mint(msg.sender, shares);
    }

    function withdrawAll(
        address _depositer,
        int128 _coin,
        uint256 _minAmount,
        bytes32 _ticker
    ) external {}

    function withdraw(
        address _depositer,
        uint256 _amount,
        bytes32 _ticker
    ) external {}

    function _totalDepositedStablecoins() private view returns (uint256 balanceOfStablecoins) {
        uint256 daiBalance = dai.balanceOf(address(this));
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 usdtBalance = usdt.balanceOf(address(this));

        return daiBalance + usdcBalance + usdtBalance;
    }
}
