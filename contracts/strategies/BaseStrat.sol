//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../utils/Constants.sol';

import '../interfaces/IUniswapRouter.sol';
import '../interfaces/IConvexMinter.sol';
import '../interfaces/IZunami.sol';

contract BaseStrat is Ownable{

    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IConvexMinter;

    IZunami public zunami;
    IERC20Metadata public crv;
    IConvexMinter public cvx;
    IUniswapRouter public router;
    address public zun;

    uint256 public constant DENOMINATOR = 1e18;
    uint256 public constant USD_MULTIPLIER = 1e12;
    uint256 public minDepositAmount = 9975; // 99.75%
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;
    address public constant BUYBACK_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    address public usdt;
    uint256 public managementFees = 0;
    uint256 public buybackFee = 0;

    event SellRewards(uint256 cvxBalance, uint256 crvBalance, uint256 extraBalance);

    modifier onlyZunami() {
        require(
            _msgSender() == address(zunami),
            'must be called by Zunami contract'
        );
        _;
    }

    constructor(
    ) {
        crv = IERC20Metadata(Constants.CRV_ADDRESS);
        cvx = IConvexMinter(Constants.CVX_ADDRESS);
        router = IUniswapRouter(Constants.SUSHI_ROUTER_ADDRESS);
        usdt = Constants.USDT_ADDRESS;
    }

    function sellCrvCvx() public virtual {
        uint256 cvxBalance = cvx.balanceOf(address(this));
        uint256 crvBalance = crv.balanceOf(address(this));
        if (cvxBalance == 0 || crvBalance == 0) {
            return;
        }
        cvx.safeApprove(address(router), cvxBalance);
        crv.safeApprove(address(router), crvBalance);

        uint256 usdtBalanceBefore = IERC20Metadata(usdt).balanceOf(address(this));
        address[] memory path = new address[](3);
        path[0] = Constants.CVX_ADDRESS;
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDT_ADDRESS;
        router.swapExactTokensForTokens(
            cvxBalance,
            0,
            path,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        path[0] = Constants.CRV_ADDRESS;
        path[1] = Constants.WETH_ADDRESS;
        path[2] = Constants.USDT_ADDRESS;
        router.swapExactTokensForTokens(
            crvBalance,
            0,
            path,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );
        uint256 usdtBalanceAfter = IERC20Metadata(usdt).balanceOf(address(this));
        managementFees += zunami.calcManagementFee(usdtBalanceAfter - usdtBalanceBefore);
        emit SellRewards(cvxBalance, crvBalance, 0);
    }

    function claimManagementFees() public virtual onlyZunami {
        uint256 stratBalance = IERC20Metadata(usdt).balanceOf(address(this));
        uint256 transferBalance = managementFees > stratBalance ? stratBalance : managementFees;
        if (transferBalance > 0) {
            uint256 adminFeeAmount = (transferBalance * buybackFee) / DEPOSIT_DENOMINATOR;
            uint256 zunBuybackAmount = transferBalance * (DEPOSIT_DENOMINATOR - buybackFee) / DEPOSIT_DENOMINATOR;
            if (adminFeeAmount > 0) {
                IERC20Metadata(usdt).safeTransfer(
                    owner(),
                    adminFeeAmount
                );
            }
            if (zunBuybackAmount > 0 && zun != address(0)) {
                IERC20Metadata(usdt).safeApprove(
                    address(router),
                    zunBuybackAmount
                );
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
        managementFees = 0;
    }

    function updateBuybackFee(uint256 _buybackFee) public onlyOwner {
        require(_buybackFee <= DEPOSIT_DENOMINATOR, 'Wrong amount!');
        buybackFee = _buybackFee;
    }

    function updateZunToken(address _zun) public onlyOwner {
        zun = _zun;
    }

    function updateMinDepositAmount(uint256 _minDepositAmount) public onlyOwner {
        require(_minDepositAmount > 0 && _minDepositAmount <= 10000, 'Wrong amount!');
        minDepositAmount = _minDepositAmount;
    }

    function renounceOwnership() public view override onlyOwner {
        revert('The strategy must have an owner');
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }
}
