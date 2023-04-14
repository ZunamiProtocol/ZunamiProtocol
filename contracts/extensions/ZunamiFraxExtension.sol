//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';
import "../interfaces/IZunamiVault.sol";
import "../interfaces/IStableConverter.sol";

//import "hardhat/console.sol";

contract ZunamiFraxExtension {
    using SafeERC20 for IERC20Metadata;

    uint128 public constant ZUNAMI_USDC_TOKEN_ID = 1;
    uint256 public constant LP_RATIO_MULTIPLIER = 1e18;

    IZunamiVault public immutable zunami;
    IStableConverter public immutable fraxUsdcConverter;

    event Deposited(address indexed depositor, uint256 tokenAmount, uint256 lpShares);
    event Withdrawn(address indexed withdrawer, uint256 lpShares, uint256 tokenAmount);

    constructor(address zunamiAddress, address fraxUsdcConverterAddress) {
        fraxUsdcConverter = IStableConverter(fraxUsdcConverterAddress);
        zunami = IZunamiVault(zunamiAddress);
    }

    function deposit(uint256 fraxAmount, uint256 minZlpAmount)
    external
    returns (uint256)
    {
        // get frax
        IERC20Metadata frax = IERC20Metadata(Constants.FRAX_ADDRESS);

        frax.safeTransferFrom(msg.sender, address(this), fraxAmount);
        // convert to USDC
        frax.safeTransfer(address(fraxUsdcConverter), fraxAmount);
        fraxUsdcConverter.handle(Constants.FRAX_ADDRESS, Constants.USDC_ADDRESS, fraxAmount, 0);
        // deposit USDC to Zunami
        IERC20Metadata usdc = IERC20Metadata(Constants.USDC_ADDRESS);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        usdc.safeIncreaseAllowance(address(zunami), usdcBalance);
        zunami.deposit([0,usdcBalance,0,0,0]);
        // transfer ZLP to user
        uint256 zlpBalance = zunami.balanceOf(address(this));
        if(minZlpAmount > 0) {
            require(zlpBalance >= minZlpAmount, "Slippage");
        }
        IERC20Metadata(address(zunami)).safeTransfer(msg.sender, zlpBalance);
        emit Deposited(msg.sender, fraxAmount, zlpBalance);
        return zlpBalance;
    }

    function withdraw(
        uint256 zlpAmount,
        uint256 minFraxAmount
    ) external {
        IERC20Metadata zlp = IERC20Metadata(address(zunami));
        // get zlp allowance
        zlp.safeTransferFrom(msg.sender, address(this), zlpAmount);

        //withdraw from zunami in USDC
        zlp.safeIncreaseAllowance(address(zunami), zlpAmount);
        zunami.withdraw(zlpAmount, [uint256(0),0,0,0,0], IStrategy.WithdrawalType.OneCoin, ZUNAMI_USDC_TOKEN_ID);

        // convert USDC to Frax
        IERC20Metadata usdc = IERC20Metadata(Constants.USDC_ADDRESS);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        usdc.safeTransfer(address(fraxUsdcConverter), usdcBalance);
        fraxUsdcConverter.handle(Constants.USDC_ADDRESS, Constants.FRAX_ADDRESS, usdcBalance, 0);

        // check min amount and send to user
        IERC20Metadata frax = IERC20Metadata(Constants.FRAX_ADDRESS);
        uint256 fraxBalance = frax.balanceOf(address(this));
        if(minFraxAmount > 0) {
            require(fraxBalance >= minFraxAmount, "Slippage");
        }
        emit Withdrawn(msg.sender, zlpAmount, fraxBalance);
        frax.safeTransfer(msg.sender, fraxBalance);
    }

    function calcWithdraw(uint256 zlpAmount) external view returns(uint256) {
        uint256 defaultWithdrawPid = zunami.defaultWithdrawPid();

        IZunamiVault.PoolInfo memory pool = zunami.poolInfo(defaultWithdrawPid);

        uint256 lpShareRatio = (zlpAmount * LP_RATIO_MULTIPLIER) / pool.lpShares;

        uint256 usdcAmount = pool.strategy.calcWithdrawOneCoin(lpShareRatio, ZUNAMI_USDC_TOKEN_ID);

        return fraxUsdcConverter.valuate(Constants.USDC_ADDRESS, Constants.FRAX_ADDRESS, usdcAmount);
    }
}
