//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './utils/Constants.sol';
import './interfaces/IStrategy.sol';

/// @title Contract for Convex&Curve protocols optimize
/// @notice Users can use this contract for optimize yield and gas

/**
 * @dev Zunami is main contract
 *
 * Contract does not store user funds.
 *
 * All user funds goes to Convex&Curve pools.
 *
 */

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

    struct PoolInfo {
        IStrategy strategy;
        uint256 startTime;
    }

    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public tokens;
    uint256[POOL_ASSETS] public decimalsMultiplierS;
    mapping(address => uint256) public deposited;
    // Info of each pool
    PoolInfo[] public poolInfo;
    uint256 public totalDeposited;

    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public managementFee = 10; // 1%
    bool public isLock = false;
    uint256 public constant MIN_LOCK_TIME = 1 days;

    PendingWithdrawal[] public pendingWithdrawals;
    mapping(address => uint256[3]) public accDepositPending;
    mapping(address => bool) public userExistence;

    event PendingDepositEvent(address depositor, uint256[3] amounts);
    event Deposited(address depositor, uint256[3] amounts, uint256 lpShares);
    event Withdrawn(address withdrawer, uint256[3] amounts, uint256 lpShares);
    event AddStrategy(address strategyAddr);
    event BadDeposit(address depositor, uint256[3] amounts, uint256 lpShares);
    event BadWithdraw(address withdrawer, uint256[3] amounts, uint256 lpShares);

    modifier isNotLocked() {
        require(!isLock, 'Zunami: Deposit functions locked');
        _;
    }

    constructor() ERC20('ZunamiLP', 'ZLP') {
        tokens[0] = Constants.DAI_ADDRESS;
        tokens[1] = Constants.USDC_ADDRESS;
        tokens[2] = Constants.USDT_ADDRESS;
        for (uint256 i; i < POOL_ASSETS; i++) {
            if (IERC20Metadata(tokens[i]).decimals() < 18) {
                decimalsMultiplierS[i] = 10**(18 - IERC20Metadata(tokens[i]).decimals());
            } else {
                decimalsMultiplierS[i] = 1;
            }
        }
    }

    /// @dev update managementFee, this is a Zunami commission from protocol profit
    function setManagementFee(uint256 newManagementFee) external onlyOwner {
        require(newManagementFee < FEE_DENOMINATOR, 'Zunami: wrong fee');
        managementFee = newManagementFee;
    }

    /// @dev Returns commission on the amount of profit in the transaction
    function calcManagementFee(uint256 amount) external view returns (uint256) {
        return (amount * managementFee) / FEE_DENOMINATOR;
    }

    /// @dev Returns commission total holdings for all pools (strategy's)
    function totalHoldings() public view returns (uint256) {
        uint256 length = poolInfo.length;
        uint256 totalHold = 0;
        for (uint256 pid = 0; pid < length; pid++) {
            totalHold += poolInfo[pid].strategy.totalHoldings();
        }
        return totalHold;
    }

    /// @dev Returns currently price of ZLP (1e18 = 1$), price depends on the income of users
    function lpPrice() external view returns (uint256) {
        return (totalHoldings() * 1e18) / totalSupply();
    }

    /// @notice in this func user sends funds to the contract and then waits for the completion of the transaction for all users
    function delegateDeposit(uint256[3] memory amounts) external isNotLocked {
        // user transfer funds to contract
        if (userExistence[_msgSender()] == false) {
            accDepositPending[_msgSender()] = [0, 0, 0];
            userExistence[_msgSender()] = true;
        }

        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                IERC20Metadata(tokens[i]).safeTransferFrom(_msgSender(), address(this), amounts[i]);
                accDepositPending[_msgSender()][i] += amounts[i];
            }
        }
        emit PendingDepositEvent(_msgSender(), amounts);
    }

    /// @notice in this func user sends pending withdraw to the contract and then waits for the completion of the transaction for all users
    function delegateWithdrawal(uint256 lpAmount, uint256[3] memory minAmounts) external {
        PendingWithdrawal memory pendingWithdrawal;
        pendingWithdrawal.lpAmount = lpAmount;
        pendingWithdrawal.minAmounts = minAmounts;
        pendingWithdrawal.withdrawer = _msgSender();
        pendingWithdrawals.push(pendingWithdrawal);
    }

    /// @notice Zunami protocol owner complete all active pending deposits of users
    function completeDeposits(address[] memory userList, uint256 pid) external onlyOwner {
        IStrategy strategy = poolInfo[pid].strategy;
        uint256[3] memory totalAmounts;
        // total sum deposit, contract => strategy
        uint256 addHoldings = 0;
        uint256 completeAmount = 0;
        uint256 holdings = totalHoldings();
        uint256[] memory userCompleteHoldings = new uint256[](userList.length);

        for (uint256 i = 0; i < userList.length; i++) {
            completeAmount = 0;

            for (uint256 x = 0; x < totalAmounts.length; x++) {
                totalAmounts[x] += accDepositPending[userList[i]][x];
                completeAmount += accDepositPending[userList[i]][x] * decimalsMultiplierS[x];
            }
            userCompleteHoldings[i] = completeAmount;
        }

        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            if (totalAmounts[y] > 0) {
                addHoldings += totalAmounts[y] * decimalsMultiplierS[y];
                IERC20Metadata(tokens[y]).safeTransfer(address(strategy), totalAmounts[y]);
            }
        }
        uint256 sum = strategy.deposit(totalAmounts);
        require(sum > 0, 'too low amount!');
        uint256 lpShares = 0;
        uint256 changedHoldings = 0;
        uint256 currentUserAmount = 0;

        for (uint256 z = 0; z < userList.length; z++) {
            currentUserAmount = (sum * userCompleteHoldings[z]) / addHoldings;
            deposited[userList[z]] += currentUserAmount;
            changedHoldings += currentUserAmount;
            if (totalSupply() == 0) {
                lpShares = currentUserAmount;
            } else {
                lpShares =
                    (currentUserAmount * totalSupply()) /
                    (holdings + changedHoldings - currentUserAmount);
            }
            _mint(userList[z], lpShares);
            strategy.updateZunamiLpInStrat(lpShares, true);
            // remove deposit from list
            delete accDepositPending[userList[z]];
            // = [0, 0, 0];
        }
        totalDeposited += changedHoldings;
    }

    /// @notice Zunami protocol owner complete all active pending withdrawals of users
    function completeWithdrawals(uint256 withdrawalsToComplete, uint256 pid) external onlyOwner {
        require(pendingWithdrawals.length > 0, 'there are no pending withdrawals requests');

        uint256 minWithdrawalsIndex = pendingWithdrawals.length > withdrawalsToComplete
            ? pendingWithdrawals.length - withdrawalsToComplete
            : 0;
        uint256 i = pendingWithdrawals.length;

        do {
            i--;
            delegatedWithdrawal(
                pendingWithdrawals[i].withdrawer,
                pendingWithdrawals[i].lpAmount,
                pendingWithdrawals[i].minAmounts,
                pid
            );
            pendingWithdrawals.pop();
        } while (i > minWithdrawalsIndex);
    }

    /// @notice deposit in one tx, without waiting complete by dev
    function deposit(uint256[3] memory amounts, uint256 pid)
        external
        isNotLocked
        returns (uint256)
    {
        IStrategy strategy = poolInfo[pid].strategy;
        require(block.timestamp >= poolInfo[pid].startTime, 'Zunami: strategy not started yet!');
        uint256 holdings = totalHoldings();

        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                IERC20Metadata(tokens[i]).safeTransferFrom(
                    _msgSender(),
                    address(strategy),
                    amounts[i]
                );
            }
        }
        uint256 sum = strategy.deposit(amounts);
        require(sum > 0, 'too low amount!');

        uint256 lpShares = 0;
        if (totalSupply() == 0) {
            lpShares = sum;
        } else {
            lpShares = (sum * totalSupply()) / holdings;
        }
        _mint(_msgSender(), lpShares);
        strategy.updateZunamiLpInStrat(lpShares, true);
        deposited[_msgSender()] += sum;
        totalDeposited += sum;

        emit Deposited(_msgSender(), amounts, lpShares);
        return lpShares;
    }

    /// @notice withdraw in one tx, without waiting complete by dev
    function withdraw(
        uint256 lpShares,
        uint256[3] memory minAmounts,
        uint256 pid
    ) external {
        IStrategy strategy = poolInfo[pid].strategy;
        require(balanceOf(_msgSender()) >= lpShares, 'Zunami: not enough LP balance');
        require(
            strategy.withdraw(_msgSender(), lpShares, minAmounts),
            'user lps share should be at least required'
        );
        uint256 userDeposit = (totalDeposited * lpShares) / totalSupply();
        _burn(_msgSender(), lpShares);
        strategy.updateZunamiLpInStrat(lpShares, false);
        if (userDeposit > deposited[_msgSender()]) {
            userDeposit = deposited[_msgSender()];
        }
        deposited[_msgSender()] -= userDeposit;
        totalDeposited -= userDeposit;
        emit Withdrawn(_msgSender(), minAmounts, lpShares);
    }

    /// @dev internal function which complete pending withdrawals
    function delegatedWithdrawal(
        address withdrawer,
        uint256 lpShares,
        uint256[3] memory minAmounts,
        uint256 pid
    ) internal {
        if ((balanceOf(withdrawer) >= lpShares) && lpShares > 0) {
            IStrategy strategy = poolInfo[pid].strategy;
            if (!(strategy.withdraw(withdrawer, lpShares, minAmounts))) {
                emit BadWithdraw(withdrawer, minAmounts, lpShares);
                return;
            }
            uint256 userDeposit = (totalDeposited * lpShares) / totalSupply();
            _burn(withdrawer, lpShares);
            strategy.updateZunamiLpInStrat(lpShares, false);
            if (userDeposit > deposited[withdrawer]) {
                userDeposit = deposited[withdrawer];
            }
            deposited[withdrawer] -= userDeposit;
            totalDeposited -= userDeposit;
            emit Withdrawn(withdrawer, minAmounts, lpShares);
        }
    }

    /// @dev security func, dev can disable all new deposits (not withdrawals)
    function setLock(bool _lock) external onlyOwner {
        isLock = _lock;
    }

    /// @dev dev withdraw commission from one strategy
    function claimManagementFees(address strategyAddr) external onlyOwner {
        IStrategy(strategyAddr).claimManagementFees();
    }

    /// @dev add new strategy in strategy list, deposits in the new strategy are blocked for one day for safety
    function add(address _strategy) external onlyOwner {
        poolInfo.push(
            PoolInfo({ strategy: IStrategy(_strategy), startTime: block.timestamp + MIN_LOCK_TIME })
        );
    }

    /// @dev dev can transfer funds between strategy's for better APY
    function moveFunds(uint256 _from, uint256 _to) external onlyOwner {
        IStrategy fromStrat = poolInfo[_from].strategy;
        IStrategy toStrat = poolInfo[_to].strategy;
        uint256[3] memory amountsBefore;
        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            amountsBefore[y] = IERC20Metadata(tokens[y]).balanceOf(address(this));
        }
        fromStrat.withdrawAll();
        uint256[3] memory amounts;
        for (uint256 i = 0; i < POOL_ASSETS; i++) {
            amounts[i] = IERC20Metadata(tokens[i]).balanceOf(address(this)) - amountsBefore[i];
            if (amounts[i] > 0) {
                IERC20Metadata(tokens[i]).safeTransfer(address(toStrat), amounts[i]);
            }
        }
        toStrat.deposit(amounts);
        uint256 transferLpAmount = fromStrat.getZunamiLpInStrat();
        fromStrat.updateZunamiLpInStrat(transferLpAmount, false);
        toStrat.updateZunamiLpInStrat(transferLpAmount, true);
    }

    /// @dev dev can transfer funds from few strategy's to one strategy for better APY
    function moveFundsBatch(uint256[] memory _from, uint256 _to) external onlyOwner {
        uint256 length = _from.length;
        uint256[3] memory amounts;
        uint256[3] memory amountsBefore;
        uint256 zunamiLp = 0;
        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            amountsBefore[y] = IERC20Metadata(tokens[y]).balanceOf(address(this));
        }
        for (uint256 i = 0; i < length; i++) {
            poolInfo[_from[i]].strategy.withdrawAll();
            uint256 thisPidLpAmount = poolInfo[_from[i]].strategy.getZunamiLpInStrat();
            zunamiLp += thisPidLpAmount;
            poolInfo[_from[i]].strategy.updateZunamiLpInStrat(thisPidLpAmount, false);
        }
        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            amounts[y] = IERC20Metadata(tokens[y]).balanceOf(address(this)) - amountsBefore[y];
            if (amounts[y] > 0) {
                IERC20Metadata(tokens[y]).safeTransfer(address(poolInfo[_to].strategy), amounts[y]);
            }
        }
        poolInfo[_to].strategy.updateZunamiLpInStrat(zunamiLp, true);
        require(poolInfo[_to].strategy.deposit(amounts) > 0, 'too low amount!');
    }

    /// @dev dev can emergency transfer funds from all strategy's to zero pool (strategy)
    function emergencyWithdraw() external onlyOwner {
        uint256 length = poolInfo.length;
        require(length > 1, 'Zunami: Nothing withdraw');
        uint256[3] memory amounts;
        uint256[3] memory amountsBefore;
        uint256 zunamiLp = 0;
        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            amountsBefore[y] = IERC20Metadata(tokens[y]).balanceOf(address(this));
        }
        for (uint256 i = 1; i < length; i++) {
            poolInfo[i].strategy.withdrawAll();
            uint256 thisPidLpAmount = poolInfo[i].strategy.getZunamiLpInStrat();
            zunamiLp += thisPidLpAmount;
            poolInfo[i].strategy.updateZunamiLpInStrat(thisPidLpAmount, false);
        }
        for (uint256 y = 0; y < POOL_ASSETS; y++) {
            amounts[y] = IERC20Metadata(tokens[y]).balanceOf(address(this)) - amountsBefore[y];
            if (amounts[y] > 0) {
                IERC20Metadata(tokens[y]).safeTransfer(address(poolInfo[0].strategy), amounts[y]);
            }
        }
        poolInfo[0].strategy.updateZunamiLpInStrat(zunamiLp, true);
        require(poolInfo[0].strategy.deposit(amounts) > 0, 'too low amount!');
    }

    /// @notice user remove his active pending deposit
    function pendingDepositRemove() external {
        for (uint256 i = 0; i < POOL_ASSETS; i++) {
            if (accDepositPending[_msgSender()][i] > 0) {
                IERC20Metadata(tokens[i]).safeTransfer(
                    _msgSender(),
                    accDepositPending[_msgSender()][i]
                );
            }
        }
        delete accDepositPending[_msgSender()];
    }

    /// @dev disable renounceOwnership for safety
    function renounceOwnership() public view override onlyOwner {
        revert('Zunami must have an owner');
    }
}
