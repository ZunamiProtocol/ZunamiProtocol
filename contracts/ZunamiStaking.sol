//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./utils/Constants.sol";
import "./interfaces/IStrategy.sol";

contract ZunamiStaker is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;         // How many LP tokens the user has provided.
        uint256 rewardDebt;     // Reward debt. See explanation below.
        uint256 withdrawTimestamp;
        uint256 lockPeriod;
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 ZunPerBlock;       // How  many tokens per block.
        uint256 lastRewardBlock;  // Last block number that Zunes distribution occurs.
        uint256 accZunPerShare;   // Accumulated Zunes per share, times 1e18. See below.
        uint256 lpSupply;
        uint256 minLockPeriod; // for example 1 week
        uint256 maxLockPeriod; // for example 52 week
    }

    IERC20 public Zun;
    address public devAddress;
    address public catsyOperations;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public startBlock;

    event Add(IERC20 indexed lpToken);
    event Set(uint256 indexed pid, uint256 indexed allocPoint);
    event UpdateStartBlock(uint256 indexed startBlock);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SetFeeAddress(address indexed user, address indexed newAddress);
    event SetDevAddress(address indexed user, address indexed newAddress);
    event AddCatsyPool(IERC20 _mainToken, address _jcatsyToken);

    constructor(
        IERC20 _Zun,
        uint256 _startBlock
    ) {
        Zun = _Zun;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(uint256 _ZunPerBlock, IERC20 _lpToken, uint256 _minLockPeriod, uint256 _maxLockPeriod) external onlyOwner {
        _lpToken.balanceOf(address(this));
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        poolInfo.push(PoolInfo({
        lpToken : _lpToken,
        ZunPerBlock : _ZunPerBlock,
        lastRewardBlock : lastRewardBlock,
        accZunPerShare : 0,
        lpSupply : 0,
        minLockPeriod : _minLockPeriod,
        maxLockPeriod : _maxLockPeriod
        }));
        emit Add(_lpToken);
    }

    // Update the given pool's Zun allocation point and deposit fee. Can only be called by the owner.
    function set(uint256 _pid, uint256 _ZunPerBlock) external onlyOwner {
        poolInfo[_pid].ZunPerBlock = _ZunPerBlock;
        emit Set(_pid, _ZunPerBlock);
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to.sub(_from);
    }

    // View function to see pending Zunes on frontend.
    function pendingZun(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accZunPerShare = pool.accZunPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ZunReward = multiplier.mul(pool.ZunPerBlock);
            accZunPerShare = accZunPerShare.add(ZunReward.mul(1e18).div(lpSupply));
        }
        return user.amount.mul(accZunPerShare).div(1e18).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.ZunPerBlock == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 ZunReward = multiplier.mul(pool.ZunPerBlock);
        pool.accZunPerShare = pool.accZunPerShare.add(ZunReward.mul(1e18).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for Zun allocation.
    function deposit(uint256 _pid, uint256 _amount, uint256 _lockPeriod) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(_lockPeriod >= pool.minLockPeriod && _lockPeriod <= pool.maxLockPeriod, "deposit: wrong lock period");
        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accZunPerShare).div(1e18).sub(user.rewardDebt);
            if (pending > 0) {
                safeZunTransfer(msg.sender, pending);
            }
        }
        uint256 lockupPeriod = block.timestamp + _lockPeriod;
        if (_amount > 0) {
            if (user.withdrawTimestamp == 0) {
                user.withdrawTimestamp = lockupPeriod;
                user.lockPeriod = _lockPeriod;
            } else {
                user.withdrawTimestamp = user.withdrawTimestamp > lockupPeriod ? user.withdrawTimestamp : lockupPeriod;
                // need calculate average lockPeriod
                user.lockPeriod = _lockPeriod;
            }
            uint256 balancebefore = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            uint256 final_amount = pool.lpToken.balanceOf(address(this)).sub(balancebefore);
            user.amount = user.amount.add(final_amount);
            pool.lpSupply = pool.lpSupply.add(final_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accZunPerShare).div(1e18);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(block.timestamp > user.withdrawTimestamp, "Withdraw: too early");
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accZunPerShare).div(1e18).sub(user.rewardDebt);
        if (pending > 0) {
            safeZunTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
            pool.lpSupply = pool.lpSupply.sub(_amount);
        }
        if (user.amount == 0) {
            user.withdrawTimestamp = 0;
            user.lockPeriod = 0;
        }
        user.rewardDebt = user.amount.mul(pool.accZunPerShare).div(1e18);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(block.timestamp > user.withdrawTimestamp, "Emergency: too early");
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        user.withdrawTimestamp = 0;
        user.lockPeriod = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    function safeZunTransfer(address _to, uint256 _amount) internal {
        uint256 ZunBal = Zun.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > ZunBal) {
            transferSuccess = Zun.transfer(_to, ZunBal);
        } else {
            transferSuccess = Zun.transfer(_to, _amount);
        }
        require(transferSuccess, "safeZunTransfer: Transfer failed");
    }
}
