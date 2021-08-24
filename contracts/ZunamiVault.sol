//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import 'hardhat/console.sol';

import { AddressAndTickers as Constants } from './helpers/AddressAndTickers.sol';
import './interfaces/IController.sol';
import './interfaces/IStrategy.sol';

contract ZunamiVault is ERC20 {
    IERC20 immutable dai;
    IERC20 immutable usdc;
    IERC20 immutable usdt;

    IController public immutable controller;

    constructor(address _controllerAddr) ERC20('zunamiLP', 'zlpt') {
        dai = IERC20(Constants.DAI_ADDRESS);
        usdc = IERC20(Constants.USDC_ADDRESS);
        usdt = IERC20(Constants.USDT_ADDRESS);

        controller = IController(_controllerAddr);
    }

    function deposit(
        address _userAddr,
        uint256 _amountOfDAI,
        uint256 _amountOfUSDC,
        uint256 _amountOfUSDT
    ) external {
        require(dai.balanceOf(_userAddr) >= _amountOfDAI, 'Insufficient funds');
        require(usdc.balanceOf(_userAddr) >= _amountOfUSDC, 'Insufficient funds');
        require(usdt.balanceOf(_userAddr) >= _amountOfUSDT, 'Insufficient funds for deposit');

        uint256 totalStablecoinsAmount = _amountOfDAI + _amountOfUSDC + _amountOfUSDT;

        dai.transferFrom(_userAddr, address(this), _amountOfDAI);
        usdc.transferFrom(_userAddr, address(this), _amountOfUSDC);
        usdt.transferFrom(_userAddr, address(this), _amountOfUSDT);

        uint256 shares = 0;
        uint256 totalSupply = totalSupply();
        uint256 totalStablecoinsInPool = _totalDepositedStablecoins();

        if (totalSupply == 0) {
            shares = totalStablecoinsAmount;
        } else {
            shares = (totalStablecoinsAmount * totalSupply) / totalStablecoinsInPool;
        }

        _mint(_userAddr, shares);

        IStrategy strategy = controller.getOptimalStrategy();
        strategy.deposit(_userAddr, _amountOfDAI, _amountOfUSDC, _amountOfUSDT);
    }

    function withdrawAll(address _userAddr) external {
        uint256 daiBalance = dai.balanceOf(_userAddr);
        uint256 usdcBalance = usdc.balanceOf(_userAddr);
        uint256 usdtBalance = usdt.balanceOf(_userAddr);

        this.withdraw(_userAddr, daiBalance, usdcBalance, usdtBalance);
    }

    function withdraw(
        address _userAddr,
        uint256 _amountOfDAI,
        uint256 _amountOfUSDC,
        uint256 _amountOfUSDT
    ) external {
        require(
            _amountOfDAI > 0 || _amountOfUSDC > 0 || _amountOfUSDT > 0,
            'Insufficient funds for withdraw'
        );

        IStrategy strategy = controller.getOptimalStrategy();
        strategy.withdraw(_userAddr, _amountOfDAI, _amountOfUSDC, _amountOfUSDT);

        uint256 totalStablecoinsForWithdraw = _amountOfDAI + _amountOfUSDC + _amountOfUSDT;
        uint256 totalSupply = totalSupply();
        uint256 totalStablecoinsInPool = _totalDepositedStablecoins();

        uint256 sharesForBurn = (totalStablecoinsForWithdraw * totalSupply) /
            totalStablecoinsInPool;

        _burn(_userAddr, sharesForBurn);
    }

    function _totalDepositedStablecoins() private view returns (uint256 balanceOfStablecoins) {
        uint256 daiBalance = dai.balanceOf(address(this));
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 usdtBalance = usdt.balanceOf(address(this));

        return daiBalance + usdcBalance + usdtBalance;
    }
}
