//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import "../interfaces/IZunamiGateway.sol";
import "../../interfaces/IUniswapRouter.sol";
import '../../utils/Constants.sol';

contract ZunamiDepositor {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenIn;
    IERC20 public immutable tokenOut;
    IZunamiGateway public immutable gateway;
    IUniswapRouter public immutable router;
    address[] inTokenToOutTokenPath;

    event Converted(uint256 inAmount, uint256 outAmount);

    constructor(
        address _tokenIn,
        address _tokenOut,
        address _gateway,
        address _router
    ) public {
        tokenIn = IERC20(_tokenIn);
        tokenOut = IERC20(_tokenOut);

        gateway = IZunamiGateway(_gateway);
        router = IUniswapRouter(_router);
        inTokenToOutTokenPath = [_tokenIn, _tokenOut];
    }

    function delegateDepositWithConversion(
        uint256 amountIn,
        uint256 amountOutMin
    )
    external
    {
        require(amountIn > 0, "Zero inTokenAmount");

        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.safeIncreaseAllowance(address(router), amountIn);

        router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            inTokenToOutTokenPath,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        uint256 amountOut = tokenOut.balanceOf(address(this));

        tokenOut.safeIncreaseAllowance(address(gateway), amountOut);
        gateway.delegateDepositFor(msg.sender, amountOut);

        emit Converted(amountIn, amountOut);
    }
}
