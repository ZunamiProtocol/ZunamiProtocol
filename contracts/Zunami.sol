//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./utils/Constants.sol";
import "./interfaces/IStrategy.sol";

contract Zunami is Context, Ownable, ERC20 {
    using SafeERC20 for IERC20Metadata;
    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public tokens;
    IStrategy public strategy;
    mapping(address => uint256) public deposited;
    uint256 public totalDeposited;

    uint256 public FEE_DENOMINATOR = 1000;
    uint256 public managementFee = 10; // 1%

    event Deposited(uint256[3] memorys, uint256 lpShares);
    event Withdrawn(uint256[3] memorys, uint256 lpShares);
    event StrategyUpdated(address strategyAddr);

    constructor() ERC20("ZunamiLP", "ZLP") {
        tokens[0] = Constants.DAI_ADDRESS;
        tokens[1] = Constants.USDC_ADDRESS;
        tokens[2] = Constants.USDT_ADDRESS;
    }

    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        managementFee = newManagementFee;
    }

    function calcManagementFee(uint256 amount)
        public
        view
        virtual
        returns (uint256)
    {
        return (amount * managementFee) / FEE_DENOMINATOR;
    }

    function updateStrategy(address strategyAddr) external virtual onlyOwner {
        if (address(strategy) != address(0)) {
            strategy.withdrawAll();
            uint256[3] memory amounts;
            for (uint256 i = 0; i < POOL_ASSETS; ++i) {
                amounts[i] = IERC20(tokens[i]).balanceOf(address(this));
            }
            strategy = IStrategy(strategyAddr);
            strategy.deposit(amounts);
        } else {
            strategy = IStrategy(strategyAddr);
        }
        emit StrategyUpdated(strategyAddr);
    }

    function getTotalValue() public view virtual returns (uint256) {
        return strategy.getTotalValue();
    }

    function deposit(uint256[3] memory amounts)
        external
        virtual
        returns (uint256)
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                    10**(18 - IERC20Metadata(tokens[i]).decimals());
            }
            sum += amounts[i] * decimalsMultiplier;
        }
        uint256 totalValue = getTotalValue();
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
            IERC20Metadata(tokens[i]).safeTransferFrom(
                _msgSender(),
                address(strategy),
                amounts[i]
            );
        }
        strategy.deposit(amounts);

        emit Deposited(amounts, lpShares);
        return lpShares;
    }

    function withdraw(uint256 lpShares, uint256[3] memory minAmounts)
        external
        virtual
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

    function claimManagementFees(address strategyAddr)
        external
        virtual
        onlyOwner
    {
        IStrategy(strategyAddr).claimManagementFees();
    }

    receive() external payable virtual {}
}
