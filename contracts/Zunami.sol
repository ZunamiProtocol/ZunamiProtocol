//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./helpers/Constants.sol";
import "./interfaces/IERC20Extended.sol";
import "./interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Zunami is Context, Ownable {
    using SafeERC20 for IERC20;
    IERC20Extended public lpToken;
    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public assets;
    IStrategy public strategy;
    mapping(address => uint256) public deposited;
    uint256 public totalDeposited;

    uint256 public feeNormalizer = 1000;
    uint256 public protocolFee = 10; // 1%

    event Deposited(uint256[] calldatas, uint256 lpShares);
    event Withdrawn(uint256[] calldatas, uint256 lpShares);
    event StrategyUpdated(address strategyAddr);

    constructor(address lpAddr) {
        assets[0] = Constants.DAI_ADDRESS;
        assets[1] = Constants.USDC_ADDRESS;
        assets[2] = Constants.USDT_ADDRESS;
        lpToken = IERC20Extended(lpAddr);
    }

    function setLPToken(address lpAddr) external onlyOwner {
        lpToken = IERC20Extended(lpAddr);
    }

    function lpSupply() public view returns (uint256) {
        return lpToken.totalSupply();
    }

    function calculateFee(uint256 amount) public view returns (uint256) {
        return (amount * protocolFee) / feeNormalizer;
    }

    function updateStrategy(address strategyAddr) external onlyOwner {
        if (address(strategy) != address(0)) {
            strategy.withdrawAll();
            uint256[] memory amounts = new uint256[](POOL_ASSETS);
            for (uint256 i = 0; i < POOL_ASSETS; ++i) {
                amounts[i] = IERC20(assets[i]).balanceOf(address(this));
            }
            strategy = IStrategy(strategyAddr);
            strategy.deposit(amounts);
        } else {
            strategy = IStrategy(strategyAddr);
        }
        emit StrategyUpdated(strategyAddr);
    }

    function getTotalValue() public returns (uint256) {
        return strategy.getTotalValue();
    }

    function deposit(uint256[] calldata amounts) external returns (uint256) {
        require(
            amounts.length == POOL_ASSETS,
            "Zunami: should have exactly pool assets"
        );

        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            sum += amounts[i];
        }

        uint256 totalValue = getTotalValue();
        if (totalValue == 0) {
            totalValue = sum;
        }

        deposited[_msgSender()] += sum;
        totalDeposited += sum;
        uint256 lpShares = (sum * lpToken.totalSupply()) / totalValue;
        lpToken.mint(lpShares);
        for (uint256 i = 0; i < amounts.length; ++i) {
            IERC20(assets[i]).safeTransferFrom(
                _msgSender(),
                address(strategy),
                amounts[i]
            );
        }
        strategy.deposit(amounts);

        emit Deposited(amounts, lpShares);
        return lpShares;
    }

    function withdraw(uint256 lpShares, uint256[] calldata minAmounts)
        external
    {
        require(
            lpToken.balanceOf(_msgSender()) >= lpShares,
            "Zunami: not enough LP balance"
        );
        strategy.withdraw(_msgSender(), lpShares, minAmounts);
        lpToken.burn(lpShares);
        uint256 userDeposit = (totalDeposited * lpShares) / lpSupply();
        deposited[_msgSender()] -= userDeposit;
        totalDeposited -= userDeposit;
        emit Withdrawn(minAmounts, lpShares);
    }

    function claimProfit() external onlyOwner {
        strategy.claimProfit();
    }
}
