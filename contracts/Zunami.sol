//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./helpers/Constants.sol";
import "./interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Zunami is Context, Ownable, ERC20 {
    using SafeERC20 for IERC20;
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

    constructor() ERC20("ZunamiLP", "ZLP") {
        assets[0] = Constants.DAI_ADDRESS;
        assets[1] = Constants.USDC_ADDRESS;
        assets[2] = Constants.USDT_ADDRESS;
    }

    function setProtocolFee(uint256 newProtocolFee) external onlyOwner {
        protocolFee = newProtocolFee;
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
        uint256 totalValue = getTotalValue();
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            sum += amounts[i];
        }
        deposited[_msgSender()] += sum;
        totalDeposited += sum;
        uint256 lpShares = 0;
        if (totalValue == 0) {
            lpShares = sum;
        } else {
            lpShares = (sum * totalSupply()) / totalValue;
        }
        _mint(_msgSender(), lpShares);
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
            balanceOf(_msgSender()) >= lpShares,
            "Zunami: not enough LP balance"
        );
        strategy.withdraw(_msgSender(), lpShares, minAmounts);
        uint256 userDeposit = (totalDeposited * lpShares) / totalSupply();
        _burn(_msgSender(), lpShares);
        deposited[_msgSender()] -= userDeposit;
        totalDeposited -= userDeposit;
        emit Withdrawn(minAmounts, lpShares);
    }

    function claimProfit() external onlyOwner {
        strategy.claimProfit();
    }
}
