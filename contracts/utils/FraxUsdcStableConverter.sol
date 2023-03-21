//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './Constants.sol';
import "../strategies/curve/interfaces/ICurvePool2.sol";
import "../strategies/interfaces/IStableConverter.sol";

contract FraxUsdcStableConverter is IStableConverter {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant SLIPPAGE_DENOMINATOR = 10_000;

    ICurvePool2 public fraxUsdcPool;

    uint256 public constant defaultSlippage = 30; // 0.3%

    mapping(address => int128) public fraxUsdcPoolStableIndex;
    mapping(address => int8) public fraxUsdcPoolStableDecimals;

    constructor() {
        fraxUsdcPool = ICurvePool2(Constants.FRAX_USDC_ADDRESS);

        fraxUsdcPoolStableIndex[Constants.FRAX_ADDRESS] = 0; //Frax
        fraxUsdcPoolStableDecimals[Constants.FRAX_ADDRESS] = 18;

        fraxUsdcPoolStableIndex[Constants.USDC_ADDRESS] = 1; //USDC
        fraxUsdcPoolStableDecimals[Constants.USDC_ADDRESS] = 6;
    }

    function handle(
        address from,
        address to,
        uint256 amount,
        uint256 slippage
    ) public {
        if (amount == 0) return;

        IERC20Metadata(from).safeIncreaseAllowance(address(fraxUsdcPool), amount);

        fraxUsdcPool.exchange(
            fraxUsdcPoolStableIndex[from],
            fraxUsdcPoolStableIndex[to],
            amount,
            applySlippage(
                amount,
                slippage,
                fraxUsdcPoolStableDecimals[to] - fraxUsdcPoolStableDecimals[from]
            )
        );
        IERC20Metadata to_ = IERC20Metadata(to);
        to_.safeTransfer(
            address(msg.sender),
            to_.balanceOf(address(this))
        );
    }

    function valuate(
        address from,
        address to,
        uint256 amount
    ) public view returns (uint256) {
        if (amount == 0) return 0;
        return fraxUsdcPool.get_dy(fraxUsdcPoolStableIndex[from], fraxUsdcPoolStableIndex[to], amount);
    }

    function applySlippage(
        uint256 amount,
        uint256 slippage,
        int8 decimalsDiff
    ) internal pure returns (uint256) {
        require(slippage <= SLIPPAGE_DENOMINATOR, 'Wrong slippage');
        if (slippage == 0) slippage = defaultSlippage;
        uint256 value = (amount * (SLIPPAGE_DENOMINATOR - slippage)) / SLIPPAGE_DENOMINATOR;
        if (decimalsDiff == 0) return value;
        if (decimalsDiff < 0) return value / (10**uint8(decimalsDiff * (-1)));
        return value * (10**uint8(decimalsDiff));
    }
}
