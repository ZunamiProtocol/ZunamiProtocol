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

    struct PendingDeposit {
        uint256[3] amounts;
        address depositor;
    }

    struct PendingWithdrawal {
        uint256 lpAmount;
        uint256[3] minAmounts;
        address withdrawer;
    }

    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public tokens;
    IStrategy public strategy;
    mapping(address => uint256) public deposited;
    uint256 public totalDeposited;

    uint256 public FEE_DENOMINATOR = 1000;
    uint256 public managementFee = 10; // 1%
    bool public isLocked = false;

    address public manager;
    address public admin;
    uint256 public completedDeposits;
    uint256 public completedWithdrawals;
    PendingDeposit[] public pendingDeposits;
    PendingWithdrawal[] public pendingWithdrawals;

    event Deposited(address depositor, uint256[3] memorys, uint256 lpShares);
    event Withdrawn(address withdrawer, uint256[3] memorys, uint256 lpShares);
    event StrategyUpdated(address strategyAddr);

    modifier onlyManager() {
        require(_msgSender() == manager, "Zunami: sender must be manager");
        _;
    }

    modifier isLocked() {
        require(!isLocked, "Zunami: Deposits functions locked");
        _;
    }

    constructor() ERC20("ZunamiLP", "ZLP") {
        tokens[0] = Constants.DAI_ADDRESS;
        tokens[1] = Constants.USDC_ADDRESS;
        tokens[2] = Constants.USDT_ADDRESS;
        manager = _msgSender();
    }

    function setManagementFee(uint256 newManagementFee) external onlyManager {
        require(newManagementFee < FEE_DENOMINATOR, "wrong fee");
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

    function updateStrategy(address strategyAddr)
    external
    virtual
    onlyOwner {
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

    function totalHoldings() public view virtual returns (uint256) {
        return strategy.totalHoldings();
    }

    function delegateDeposit(uint256[3] memory amounts)
    external
    virtual
    isLocked {
        PendingDeposit memory pendingDeposit;
        pendingDeposit.amounts = amounts;
        pendingDeposit.depositor = _msgSender();
        pendingDeposits.push(pendingDeposit);
    }

    function delegateWithdrawal(uint256 lpAmount, uint256[3] memory minAmounts)
    external
    virtual
    {
        PendingWithdrawal memory pendingWithdrawal;
        pendingWithdrawal.lpAmount = lpAmount;
        pendingWithdrawal.minAmounts = minAmounts;
        pendingWithdrawal.withdrawer = _msgSender();
        pendingWithdrawals.push(pendingWithdrawal);
    }

    function completeDeposits(uint256 depositsToComplete)
    external
    virtual
    onlyOwner
    {
        for (
            uint256 i = completedDeposits;
            i < completedDeposits + depositsToComplete;
            ++i
        ) {
            delegatedDeposit(
                pendingDeposits[i].depositor,
                pendingDeposits[i].amounts
            );
        }
        completedDeposits += depositsToComplete;
    }

    function completeWithdrawals(uint256 withdrawalsToComplete)
    external
    virtual
    onlyOwner
    {
        for (
            uint256 i = completedWithdrawals;
            i < completedWithdrawals + withdrawalsToComplete;
            ++i
        ) {
            delegatedWithdrawal(
                pendingWithdrawals[i].withdrawer,
                pendingWithdrawals[i].lpAmount,
                pendingWithdrawals[i].minAmounts
            );
        }
        completedWithdrawals += withdrawalsToComplete;
    }

    function deposit(uint256[3] memory amounts)
    external
    virtual
    isLocked
    returns (uint256)
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                10 ** (18 - IERC20Metadata(tokens[i]).decimals());
            }
            sum += amounts[i] * decimalsMultiplier;
        }
        uint256 holdings = totalHoldings();
        deposited[_msgSender()] += sum;
        totalDeposited += sum;

        uint256 lpShares = 0;
        if (holdings == 0) {
            lpShares = sum;
        } else {
            lpShares = (sum * totalSupply()) / holdings;
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

        emit Deposited(_msgSender(), amounts, lpShares);
        return lpShares;
    }

    function delegatedDeposit(address depositor, uint256[3] memory amounts)
    internal
    virtual
    returns (uint256)
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 decimalsMultiplier = 1;
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplier =
                10 ** (18 - IERC20Metadata(tokens[i]).decimals());
            }
            sum += amounts[i] * decimalsMultiplier;
        }
        uint256 holdings = totalHoldings();
        deposited[depositor] += sum;
        totalDeposited += sum;

        uint256 lpShares = 0;
        if (holdings == 0) {
            lpShares = sum;
        } else {
            lpShares = (sum * totalSupply()) / holdings;
        }
        _mint(depositor, lpShares);

        for (uint256 i = 0; i < amounts.length; ++i) {
            IERC20Metadata(tokens[i]).safeTransferFrom(
                depositor,
                address(strategy),
                amounts[i]
            );
        }
        strategy.deposit(amounts);

        emit Deposited(depositor, amounts, lpShares);
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
        emit Withdrawn(_msgSender(), minAmounts, lpShares);
    }

    function delegatedWithdrawal(
        address withdrawer,
        uint256 lpShares,
        uint256[3] memory minAmounts
    ) internal virtual {
        require(
            balanceOf(withdrawer) >= lpShares,
            "Zunami: not enough LP balance"
        );
        strategy.withdraw(withdrawer, lpShares, minAmounts);
        uint256 userDeposit = (totalDeposited * lpShares) / totalSupply();
        _burn(withdrawer, lpShares);
        deposited[withdrawer] -= userDeposit;
        totalDeposited -= userDeposit;
        emit Withdrawn(withdrawer, minAmounts, lpShares);
    }

    function setLock(bool _lock) external
    virtual
    onlyOwner
    {
        isLocked = _lock;
    }

    function claimManagementFees(address strategyAddr)
    external
    virtual
    onlyManager
    {
        IStrategy(strategyAddr).claimManagementFees();
    }

    receive() external payable virtual {}
}
