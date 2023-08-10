//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import "../utils/Constants.sol";
import "../interfaces/IZunamiVault.sol";
import "../interfaces/IZunamiStableVault.sol";
import "../strategies/interfaces/ICurvePool2.sol";
import "../strategies/interfaces/IStableConverter.sol";
import "../interfaces/IZunamiApsVault.sol";

//import "hardhat/console.sol";

contract ZunamiUzdZap {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant ZUNAMI_DAI_TOKEN_ID = 0;
    uint256 public constant ZUNAMI_USDC_TOKEN_ID = 1;
    uint256 public constant ZUNAMI_USDT_TOKEN_ID = 2;

    uint256 constant FRAX_USDC_POOL_USDC_ID = 1;
    int128 constant FRAX_USDC_POOL_USDC_ID_INT = 1;

    uint256 constant CRVFRAX_TOKEN_POOL_UZD_ID = 0;
    int128 constant CRVFRAX_TOKEN_POOL_UZD_ID_INT = 0;
    uint256 constant CRVFRAX_TOKEN_POOL_CRVFRAX_ID = 1;
    int128 constant CRVFRAX_TOKEN_POOL_CRVFRAX_ID_INT = 1;

    // fraxUsdcPool = FRAX + USDC => crvFrax
    ICurvePool2 public constant fraxUsdcPool = ICurvePool2(Constants.FRAX_USDC_ADDRESS);
    IERC20Metadata public constant fraxUsdcPoolLp = IERC20Metadata(Constants.FRAX_USDC_LP_ADDRESS); // crvFrax

    // crvFraxTokenPool = crvFrax + Token
    ICurvePool2 public constant crvFraxTokenPool = ICurvePool2(Constants.CRV_FRAX_UZD_ADDRESS);
    IERC20Metadata public constant crvFraxTokenPoolLp = ICurvePool2(Constants.CRV_FRAX_UZD_LP_ADDRESS);

    IZunamiApsVault public constant zunamiApsPool = IZunamiApsVault("0xCaB49182aAdCd843b037bBF885AD56A3162698Bd");
    IZunamiStableVault public constant zunamiStable = IZunamiStableVault("0xb40b6608B2743E691C9B54DdBDEe7bf03cd79f1c");

    IStableConverter public constant stableConverter = IStableConverter("0xce5c753716607110ce702042f080580f5c29f892");

    address[3] public tokens = [
        0x6B175474E89094C44Da98b954EedeAC495271d0F,
        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
        0xdAC17F958D2ee523a2206206994597C13D831ec7
    ];

    function deposit(uint256[3] memory amounts, uint256 minStableAmount, uint256 minApsLpAmount)
    external
    returns (uint256)
    {
        IERC20Metadata usdc = tokens[ZUNAMI_USDC_TOKEN_ID];

        //swap all to usdc
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                IERC20Metadata(tokens[i]).safeTransferFrom(
                    msg.sender,
                    address(this),
                    amounts[i]
                );

                if(i == ZUNAMI_DAI_TOKEN_ID || i == ZUNAMI_USDT_TOKEN_ID) {
                    swapTokenToUSDC(tokens[i]);
                }
            }
        }

        // total balance after conversion
        uint256 usdcAmount = usdc.balanceOf(address(this));

        //mint crvFRAX
        uint256[2] memory amounts;
        amounts[FRAX_USDC_POOL_USDC_ID] = usdcAmount;
        usdc.safeIncreaseAllowance(
            address(fraxUsdcPool),
            usdcAmount
        );
        uint256 crvFraxAmount = fraxUsdcPool.add_liquidity(amounts, 0);

        fraxUsdcPoolLp.safeIncreaseAllowance(address(crvFraxTokenPool), crvFraxAmount);

        //exchange crvFRAX to UZD
        uint256 zStableAmount = crvFraxTokenPool.exchange_underlying(
            CRVFRAX_TOKEN_POOL_CRVFRAX_ID_INT,
            CRVFRAX_TOKEN_POOL_UZD_ID_INT,
            crvFraxAmount,
            0
        );
        require(zStableAmount >= minStableAmount, "Not enough stable");

        //stake UZD
        IERC20Metadata(address(zunamiStable)).safeIncreaseAllowance(address(zunamiApsPool), zStableAmount);
        uint256 apsLpAmount = zunamiApsPool.deposit(zStableAmount,0);
        require(apsLpAmount >= minApsLpAmount, "Not enough aps lp");

        IERC20Metadata(address(zunamiApsPool)).safeTransfer(msg.sender, apsLpAmount);
        return apsLpAmount;
    }

    function swapTokenToUSDC(IERC20Metadata token) internal {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) return;

        token.safeTransfer(address(stableConverter), balance);
        stableConverter.handle(
            address(token),
            address(tokens[ZUNAMI_USDC_TOKEN_ID]),
            balance,
            0
        );
    }
}
