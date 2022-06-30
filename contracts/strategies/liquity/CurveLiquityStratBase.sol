//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../interfaces/IZunami.sol';
import '../../interfaces/ICurvePool.sol';
import '../../interfaces/ICurvePool2.sol';

import './IStabilityPool.sol';

import 'hardhat/console.sol';

/*
1. меняем usdt/usdc/dai в пуле lusd (https://curve.fi/lusd) на lusd
2. депонируем их в stability pool на liquity https://liquity.app
3. нам начисляют дополнительные LQTY - их клеймим продаем за LUSD и реинвестируем в стабилити пул
4. Нам начисляют ETH, клеймим и продаём за lusd реинвестируем в стабилити пул
*/

/**
 * @title The strategy for working with the Liquidity protocol
 * @notice This strategy is a liquidity provider of the lusd stablecoin
 */
contract CurveLiquityStratBase is Ownable {
    using SafeERC20 for IERC20Metadata;
    enum WithdrawalType {
        Base,
        OneCoin
    }

    struct Config {
        IERC20Metadata[3] underlyingTokens;
    }
    Config internal _config;

    IZunami public zunami;
    ICurvePool pool3;
    ICurvePool2 lusdPool;
    IStabilityPool liquityPool;
    IERC20Metadata pool3LP;
    IERC20Metadata lusdToken;
    IERC20Metadata lqtyToken;

    error CurveLiquityStratBase__OnlyZunamiError(address zunami, address sender);
    error CurveLiquityStratBase__OperationsWithNullBalance(address token, uint256 balance);

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        if (_msgSender() != address(zunami)) {
            revert CurveLiquityStratBase__OnlyZunamiError(address(zunami), _msgSender());
        }
        _;
    }

    constructor(
        IERC20Metadata[3] memory underlyingTokens,
        address pool3Addr,
        address pool3LPAddr,
        address lusdPoolAddr,
        address lusdTokenAddr,
        address liquityPoolAddr,
        address lqtyTokenAddr
    ) {
        _config = Config(underlyingTokens);
        pool3 = ICurvePool(pool3Addr);
        pool3LP = IERC20Metadata(pool3LPAddr);
        lusdPool = ICurvePool2(lusdPoolAddr);
        lusdToken = IERC20Metadata(lusdTokenAddr);
        liquityPool = IStabilityPool(liquityPoolAddr);
        lqtyToken = IERC20Metadata(lqtyTokenAddr);
    }

    /**
     * @notice Provide liquidity to the Liquity
     * @dev It's neccesary to get lusd from the Curve
     * @param amounts array of stablecoins where 0 - dai, 1 - usdc, 2 - usdt
     * @return Returns deposited amount in LUSD.
     */
    function deposit(uint256[3] memory amounts) external returns (uint256) {
        // 1. Get LUSD from lusd pool
        // 2. Deposit lusd to liquity
        uint256 lusdAmount = getLUSD(amounts);
        if (lusdAmount == 0)
            revert CurveLiquityStratBase__OperationsWithNullBalance(address(lusdToken), lusdAmount);
        console.log(
            'CurveLiquityStratBase.sol:82: lusd --- %s',
            (lusdToken.balanceOf(address(this)))
        );
        uint256 balanceBefore = lqtyToken.balanceOf(address(this));
        console.log('CurveLiquityStratBase.sol:85: balanceBefore --- %s', balanceBefore);
        lusdToken.safeIncreaseAllowance(address(liquityPool), lusdAmount);
        liquityPool.provideToSP(lusdAmount, address(0));
        console.log(
            'CurveLiquityStratBase.sol:82: lusd --- %s',
            (lusdToken.balanceOf(address(this)))
        );
        uint256 balanceAfter = lqtyToken.balanceOf((address(this)));
        console.log('CurveLiquityStratBase.sol:88: balanceAfter --- %s', balanceAfter);

        return 1;
    }

    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        WithdrawalType withdrawalType,
        uint128 tokenIndex
    ) external returns (bool) {}

    function withdrawAll() external {}

    function totalHoldings() external view returns (uint256) {}

    function claimManagementFees() external returns (uint256) {}

    function autoCompound() external {}

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        external
        view
        returns (uint256 tokenAmount)
    {}

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        external
        view
        returns (uint256 sharesAmount)
    {}

    /**
     * @dev dev set Zunami (main contract) address
     * @param zunamiAddr - address of main contract (Zunami)
     */
    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function getLUSD(uint256[3] memory tokenAmounts) internal returns (uint256 lusdAmount) {
        for (uint256 i = 0; i < 3; i++) {
            _config.underlyingTokens[i].safeIncreaseAllowance(address(pool3), tokenAmounts[i]);
        }
        pool3.add_liquidity(tokenAmounts, 0);
        uint256 lp3Amount = pool3LP.balanceOf(address(this));

        if (lp3Amount == 0)
            revert CurveLiquityStratBase__OperationsWithNullBalance(address(pool3LP), lp3Amount);

        pool3LP.safeIncreaseAllowance(address(lusdPool), lp3Amount);
        int128 sellCoinIndex = 1;
        int128 buyCoinIndex = 0;
        lusdAmount = lusdPool.exchange(sellCoinIndex, buyCoinIndex, lp3Amount, 0);
    }
}
