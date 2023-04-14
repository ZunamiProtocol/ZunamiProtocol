//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../../utils/Constants.sol';
import '../../../interfaces/ICurvePool.sol';
import '../../../interfaces/IStableConverter.sol';

//import "hardhat/console.sol";

contract StableConverter is IStableConverter {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant SLIPPAGE_DENOMINATOR = 10_000;

    ICurvePool public immutable curve3Pool;

    uint256 public constant defaultSlippage = 30; // 0.3%

    mapping(address => int128) public curve3PoolStableIndex;
    mapping(address => int8) public curve3PoolStableDecimals;

    constructor() {
        curve3Pool = ICurvePool(Constants.CRV_3POOL_ADDRESS);

        curve3PoolStableIndex[Constants.DAI_ADDRESS] = 0; //DAI
        curve3PoolStableDecimals[Constants.DAI_ADDRESS] = 18;

        curve3PoolStableIndex[Constants.USDC_ADDRESS] = 1; //USDC
        curve3PoolStableDecimals[Constants.USDC_ADDRESS] = 6;

        curve3PoolStableIndex[Constants.USDT_ADDRESS] = 2; //USDT
        curve3PoolStableDecimals[Constants.USDT_ADDRESS] = 6;
    }

    function handle(
        address from,
        address to,
        uint256 amount,
        uint256 slippage
    ) public {
        if (amount == 0) return;

        IERC20Metadata(from).safeIncreaseAllowance(address(curve3Pool), amount);

        curve3Pool.exchange(
            curve3PoolStableIndex[from],
            curve3PoolStableIndex[to],
            amount,
            applySlippage(
                amount,
                slippage,
                curve3PoolStableDecimals[to] - curve3PoolStableDecimals[from]
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
        return curve3Pool.get_dy(curve3PoolStableIndex[from], curve3PoolStableIndex[to], amount);
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
