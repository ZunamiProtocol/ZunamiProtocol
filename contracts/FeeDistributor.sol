//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './utils/Constants.sol';

import './interfaces/IUniswapRouter.sol';

contract FeeDistributor is Ownable {
    using SafeERC20 for IERC20Metadata;

    address public zunami;
    IUniswapRouter public router;
    address public zun;

    uint256 public constant DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;
    address public constant BUYBACK_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public usdt;
    uint256 public buybackFee = 0;

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        require(_msgSender() == zunami, 'must be called by Zunami contract');
        _;
    }

    constructor() {
        router = IUniswapRouter(Constants.SUSHI_ROUTER_ADDRESS);
        usdt = Constants.USDT_ADDRESS;
    }

    /**
     * @dev dev disitribute managementFees from strategy.
     * zunBuybackAmount goes to buyback ZUN token if buybackFee > 0 && ZUN address not a zero.
     * adminFeeAmount is amount for transfer to dev or governance.
     * when tx completed = 0
     */
    function disitributeFee() public {
        uint256 stratBalance = IERC20Metadata(usdt).balanceOf(address(this));
        uint256 transferBalance = stratBalance;
        if (transferBalance > 0) {
            uint256 zunBuybackAmount = (transferBalance * buybackFee) / DEPOSIT_DENOMINATOR;
            uint256 adminFeeAmount = (transferBalance * (DEPOSIT_DENOMINATOR - buybackFee)) /
                DEPOSIT_DENOMINATOR;
            if (adminFeeAmount > 0) {
                IERC20Metadata(usdt).safeTransfer(owner(), adminFeeAmount);
            }
            if (zunBuybackAmount > 0 && zun != address(0)) {
                IERC20Metadata(usdt).safeApprove(address(router), zunBuybackAmount);
                address[] memory path = new address[](3);
                path[0] = usdt;
                path[1] = Constants.WETH_ADDRESS;
                path[2] = zun;
                router.swapExactTokensForTokens(
                    zunBuybackAmount,
                    0,
                    path,
                    BUYBACK_ADDRESS,
                    block.timestamp + Constants.TRADE_DEADLINE
                );
            }
        }
    }


}
