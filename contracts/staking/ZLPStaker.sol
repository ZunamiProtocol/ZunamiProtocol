// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '../interfaces/IVeZunToken.sol';
import './BaseStaking.sol';

contract ZLPStaker is BaseStaking {
    using Math for uint256;
    using SafeERC20 for IERC20;

    IVeZunToken public xZLP;
    IERC20 public ZLP;

    constructor(
        IERC20 _Zun,
        IVeZunToken _xZLP,
        IERC20 _ZLP
    ) {
        Zun = _Zun;
        xZLP = _xZLP;
        ZLP = _ZLP;
    }

    function deposit(uint256 _amount, uint256 _duration) external {
        require(_amount > 0, 'bad _amount');
        // Don't allow locking > maxLockDuration
        uint256 duration = _duration.min(maxLockDuration);
        // Enforce min lockup duration to prevent flash loan or MEV transaction ordering
        duration = duration.max(MIN_LOCK_DURATION);
        updatePool();

        ZLP.safeTransferFrom(_msgSender(), address(this), _amount);
        uint256 mintAmount = (_amount * getMultiplier(duration)) / 1e18;

        depositsOf[_msgSender()].push(
            Deposit({
                amount: _amount,
                mintedAmount: mintAmount,
                rewardDebt: (mintAmount * accZunPerShare) / 1e18,
                start: uint64(block.timestamp),
                end: uint64(block.timestamp) + uint64(duration)
            })
        );
        totalDepositOf[_msgSender()] += _amount;

        xZLP.mint(_msgSender(), mintAmount);
        lpSupply += mintAmount;
        emit Deposited(_amount, duration, _msgSender());
    }

    function withdraw(uint256 _depositId) external {
        require(_depositId < depositsOf[_msgSender()].length, '!exist');
        Deposit storage userDeposit = depositsOf[_msgSender()][_depositId];
        require(block.timestamp >= userDeposit.end, 'too soon');
        updatePool();

        // get rewards
        uint256 pending = (userDeposit.mintedAmount * accZunPerShare) /
            1e18 -
            userDeposit.rewardDebt;

        totalDepositOf[_msgSender()] -= userDeposit.amount;
        // burn pool shares
        IERC20(address(xZLP)).safeTransferFrom(
            _msgSender(),
            address(this),
            userDeposit.mintedAmount
        );
        xZLP.burn(userDeposit.mintedAmount);
        lpSupply -= userDeposit.mintedAmount;

        // return tokens
        safeZunTransfer(_msgSender(), pending);
        ZLP.safeTransfer(_msgSender(), userDeposit.amount);
        emit Withdrawn(_depositId, _msgSender(), userDeposit.amount);

        // remove Deposit
        userDeposit = depositsOf[_msgSender()][depositsOf[_msgSender()].length - 1];
        depositsOf[_msgSender()].pop();
    }
}
