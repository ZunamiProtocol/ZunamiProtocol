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
import "../interfaces/INativeConverter.sol";
import "../interfaces/IWETH.sol";

//import "hardhat/console.sol";

contract ZunamiZethZap {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant ZUNAMI_ETH_TOKEN_ID = 0;
    uint256 public constant ZUNAMI_wETH_TOKEN_ID = 1;
    uint256 public constant ZUNAMI_frxETH_TOKEN_ID = 2;

    uint256 constant FRXETH_TOKEN_POOL_TOKEN_ID = 0;
    int128 constant FRXETH_TOKEN_POOL_TOKEN_ID_INT = 0;
    uint256 constant FRXETH_TOKEN_POOL_FRXETH_ID = 1;
    int128 constant FRXETH_TOKEN_POOL_FRXETH_ID_INT = 1;

    // frxEthTokenPool = Token + frxEth
    ICurvePool2 public constant frxEthTokenPool = ICurvePool2(0xfC89b519658967fCBE1f525f1b8f4bf62d9b9018);

    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IZunamiApsVault public constant zunamiApsPool = IZunamiApsVault("0x8fc72dcfbf39FE686c96f47C697663EE08C78380");
    IZunamiStableVault public constant zunamiStable = IZunamiStableVault("0xe47f1CD2A37c6FE69e3501AE45ECA263c5A87b2b");

    INativeConverter public constant fraxConverter = INativeConverter("0xAe525CE04abe27c4D759C8E0E8b3b8AE36aa5d7e");

    address[5] public tokens = [
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
        0x5E8422345238F34275888049021821E8E08CAa1f,
        0x0,
        0x0
    ];

    IWETH public constant weth = IWETH(payable(Constants.WETH_ADDRESS));

    function deposit(uint256[5] memory amounts, uint256 minStableAmount, uint256 minApsLpAmount)
    external
    payable
    returns (uint256)
    {
        IERC20Metadata frxEth = tokens[ZUNAMI_frxETH_TOKEN_ID];

        getSenderToken(amounts[ZUNAMI_frxETH_TOKEN_ID], IERC20Metadata(tokens[ZUNAMI_frxETH_TOKEN_ID]));
        getSenderToken(amounts[ZUNAMI_wETH_TOKEN_ID], IERC20Metadata(tokens[ZUNAMI_wETH_TOKEN_ID]));

        //unwrap wETH if any
        if(amounts[ZUNAMI_wETH_TOKEN_ID]) {
            unwrapETH(amounts[ZUNAMI_wETH_TOKEN_ID]);
        }

        //swap ETH to frxEth
        uint256 ethBalance = address(this).balance;
        if(ethBalance > 0) {
            fraxConverter.handle{value: ethBalance}(
                true, ethBalance, 0
            );
        }

        // total balance after conversion
        uint256 frxEthAmount = frxEth.balanceOf(address(this));

        //convert frxEth to zETH
        frxEth.safeIncreaseAllowance(
            address(frxEthTokenPool),
            frxEthAmount
        );

        uint256 zStableAmount = frxEthTokenPool.exchange_underlying(
            FRXETH_TOKEN_POOL_FRXETH_ID_INT,
            FRXETH_TOKEN_POOL_TOKEN_ID_INT,
            frxEthAmount,
            0
        );
        require(zStableAmount >= minStableAmount, "Not enough stable");

        //stake zETH
        IERC20Metadata(address(zunamiStable)).safeIncreaseAllowance(address(zunamiApsPool), zStableAmount);
        uint256 apsLpAmount = zunamiApsPool.deposit(zStableAmount, 0);
        require(apsLpAmount >= minApsLpAmount, "Not enough aps lp");

        IERC20Metadata(address(zunamiApsPool)).safeTransfer(msg.sender, apsLpAmount);
        return apsLpAmount;
    }

    function getSenderToken(IERC20Metadata token, uint256 amount) internal {
        if(amount > 0) {
            token.safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }
    }

    function unwrapETH(uint256 amount) internal {
        weth.withdraw(amount);
    }
}


