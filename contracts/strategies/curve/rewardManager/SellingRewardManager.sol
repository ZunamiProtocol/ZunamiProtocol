//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../../utils/Constants.sol';
import "../../../interfaces/IUniswapRouter.sol";

//import "hardhat/console.sol";

contract SellingRewardManager {
    using SafeERC20 for IERC20Metadata;

    IUniswapRouter public router;
    address public middleSwapToken;

    event SoldReward(address reward, uint256 amound);

    constructor(
        address routerAddr,
        address middleSwapTokenAddr
    ) {
        require(routerAddr != address(0), "Zero router");
        require(middleSwapTokenAddr != address(0), "Zero middle swap token");
        router = IUniswapRouter(routerAddr);
        middleSwapToken = middleSwapTokenAddr;
    }

    function handle(address reward, uint256 amount, address feeToken) public {
        IERC20Metadata(reward).safeApprove(address(router), amount);
        router.swapExactTokensForTokens(
            amount,
            0,
            fromAddressArr3([reward, middleSwapToken, feeToken]),
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );
    }

    function valuate(address reward, uint256 amount, address feeToken) public view returns(uint256) {
        return priceTokenByExchange(amount, fromAddressArr3([reward, middleSwapToken, feeToken]));
    }

    function priceTokenByExchange(uint256 amount, address[] memory exchangePath)
    internal
    view
    returns (uint256)
    {
        if (amount == 0) return 0;
        uint256[] memory amounts = router.getAmountsOut(amount, exchangePath);
        return amounts[amounts.length - 1];
    }

    function fromAddressArr3(address[3] memory arr) internal pure returns (address[] memory arrInf) {
        arrInf = new address[](3);
        arrInf[0] = arr[0];
        arrInf[1] = arr[1];
        arrInf[2] = arr[2];
    }
}
