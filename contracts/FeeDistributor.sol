//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './utils/Constants.sol';

import './interfaces/IUniswapRouter.sol';
import './interfaces/IZunStaker.sol';

contract FeeDistributor is Ownable {
    using SafeERC20 for IERC20Metadata;

    address public zunami;
    IUniswapRouter public router;
    address public zun;
    IZunStaker public zunStaker;

    uint256 public constant DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;
    address public constant BUYBACK_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public usdt;
    uint256 public buybackFee = 0;

    bool public distributeActive = false;

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
     * if distributeActive all managementFees goes to staking contract for distribute rewards between users
     * when tx completed = 0
     */
    function disitributeFee() public {
        uint256 stratBalance = IERC20Metadata(usdt).balanceOf(address(this));
        if (stratBalance > 0) {
            if (!distributeActive) {
                uint256 zunBuybackAmount = (stratBalance * buybackFee) / DEPOSIT_DENOMINATOR;
                uint256 adminFeeAmount = (stratBalance * (DEPOSIT_DENOMINATOR - buybackFee)) /
                DEPOSIT_DENOMINATOR;
                if (adminFeeAmount > 0) {
                    if (IERC20Metadata(usdt).allowance(address(this), owner()) == 0) {
                        IERC20Metadata(usdt).safeApprove(owner(), Constants.MAX_UINT_NUMBER);
                    }
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
            if (distributeActive) {
                if (IERC20Metadata(usdt).allowance(address(this), address(zunStaker)) == 0) {
                    IERC20Metadata(usdt).safeApprove(address(zunStaker), Constants.MAX_UINT_NUMBER);
                }
                zunStaker.updateUsdtPerShare(stratBalance);
            }
        }

    }

    /**
     * @dev updateDistributeActive can be called only by owner and change distributeActive to false/true
     * @param _distributeActive - boolean function can be called only by owner
     */
    function updateDistributeActive(bool _distributeActive) external onlyOwner {
        distributeActive = _distributeActive;
    }
}
