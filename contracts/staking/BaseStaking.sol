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

contract BaseStaking is Ownable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public maxBonus = 1e18;
    uint256 public maxLockDuration = 31536000; // 1 year
    uint256 public constant MIN_LOCK_DURATION = 2 weeks; // 1209600 sec

    IERC20 public Zun;

    struct Deposit {
        uint256 amount;
        uint256 mintedAmount;
        uint256 rewardDebt;
        uint64 start;
        uint64 end;
    }

    mapping(address => Deposit[]) public depositsOf;
    mapping(address => uint256) public totalDepositOf;

    uint256 public lpSupply; // total supply
    uint256 public accZunPerShare = 0;
    uint256 public lastRewardBlock = 0; // change in prod
    uint256 public ZunPerBlock = 1e18; // change in prod

    bool public isClaimLock = false;

    constructor() {}

    event Deposited(uint256 amount, uint256 duration, address indexed receiver);
    event Withdrawn(uint256 indexed depositId, address indexed receiver, uint256 amount);

    /**
     * @dev Throws if isClaimLock true
     */
    modifier isClaimNotLocked() {
        require(!isClaimLock, 'ZunStaker: Claim functions locked');
        _;
    }

    /**
     * @dev updatePool can be called by anyone, update rewards for all users to current block
     */
    function updatePool() public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        if (lpSupply == 0 || ZunPerBlock == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = block.number - lastRewardBlock;
        uint256 ZunReward = multiplier * ZunPerBlock;
        accZunPerShare += (ZunReward * 1e18) / lpSupply;
        lastRewardBlock = block.number;
    }

    /**
     * @dev view function can be called by anyone return multiplicator that can be received
     * @return return multiplicator that can be received for this _lockDuration
     * @param _lockDuration - number in seconds
     */
    function getMultiplier(uint256 _lockDuration) public view returns (uint256) {
        return 1e18 + ((maxBonus * _lockDuration) / maxLockDuration);
    }

    /**
     * @dev view function can be called by anyone, show active deposits by user address
     * @return return array of deposits by user address in limit
     * @param _account - account of user
     * @param skip - how much skip deposits in array
     * @param limit - deposits array limit
     */
    function getDepositsOf(
        address _account,
        uint256 skip,
        uint256 limit
    ) public view returns (Deposit[] memory) {
        Deposit[] memory _depositsOf = new Deposit[](limit);
        uint256 depositsOfLength = depositsOf[_account].length;

        if (skip >= depositsOfLength) return _depositsOf;

        for (uint256 i = skip; i < (skip + limit).min(depositsOfLength); i++) {
            _depositsOf[i - skip] = depositsOf[_account][i];
        }

        return _depositsOf;
    }

    /**
     * @dev view function can be called by anyone, show deposits array length by user address
     * @return return length of array of deposits by user address
     * @param _account - account of user
     */
    function getDepositsOfLength(address _account) public view returns (uint256) {
        return depositsOf[_account].length;
    }

    /**
     * @dev view function to see pending ZUN rewards on frontend
     * @return return number of pending ZUN rewards by user address
     * @param _depositId - deposit id for search in deposits array by user address
     * @param _user - account of user
     */
    function pendingZun(uint256 _depositId, address _user) public view returns (uint256) {
        Deposit memory userDeposit = depositsOf[_user][_depositId];
        uint256 localShare = accZunPerShare;
        if (block.number > lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = block.number - lastRewardBlock;
            uint256 ZunReward = multiplier * ZunPerBlock;
            localShare = accZunPerShare + ((ZunReward * 1e18) / lpSupply);
        }
        return (userDeposit.mintedAmount * localShare) / 1e18 - userDeposit.rewardDebt;
    }

    /**
     * @dev onlyOwner function, owner can change ZUN rewards per block for all users
     * @param _ZunPerBlock - owner can change ZUN rewards per block
     */
    function updateZunPerBlock(uint256 _ZunPerBlock) public onlyOwner {
        updatePool();
        ZunPerBlock = _ZunPerBlock;
    }

    /**
     * @dev onlyOwner function, owner can disable all user claims (not withdrawals)
     * @param _isClaimLock - boolean function, if true all claims is locked
     */
    function changeClaimLock(bool _isClaimLock) public onlyOwner {
        isClaimLock = _isClaimLock;
    }

    /**
     * @dev public function, user can claim rewards by deposit id
     * @param _depositId - number of deposit in deposits array by user address
     */
    function claim(uint256 _depositId) public isClaimNotLocked {
        updatePool();
        _claim(_msgSender(), _depositId);
    }

    /**
     * @dev public function, user can claim rewards from all deposits
     */
    function claimAll() public isClaimNotLocked {
        updatePool();
        uint256 length = getDepositsOfLength(_msgSender());

        for (uint256 depId = 0; depId < length; ++depId) {
            _claim(_msgSender(), depId);
        }
    }

    /**
     * @dev view function to see pending ZUN rewards for all user deposits on frontend
     * @return return number of total pending ZUN rewards by user address
     * @param _user - account of user
     */
    function pendingZunTotal(address _user) public view returns (uint256) {
        uint256 length = getDepositsOfLength(_user);
        uint256 totalPending = 0;
        uint256 localShare = accZunPerShare;
        if (block.number > lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = block.number - lastRewardBlock;
            uint256 ZunReward = multiplier * ZunPerBlock;
            localShare = accZunPerShare + ((ZunReward * 1e18) / lpSupply);
        }
        for (uint256 i = 0; i < length; i++) {
            totalPending +=
                (depositsOf[_user][i].mintedAmount * localShare) /
                1e18 -
                depositsOf[_user][i].rewardDebt;
        }
        return totalPending;
    }

    function _claim(address user, uint256 _depositId) internal {
        Deposit storage userDeposit = depositsOf[user][_depositId];
        uint256 pending = (userDeposit.mintedAmount * accZunPerShare) /
            1e18 -
            userDeposit.rewardDebt;
        if (pending > 0) {
            safeZunTransfer(user, pending);
        }
        userDeposit.rewardDebt = (userDeposit.mintedAmount * accZunPerShare) / 1e18;
    }

    function safeZunTransfer(address _to, uint256 _amount) internal {
        uint256 ZunBal = Zun.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > ZunBal) {
            transferSuccess = Zun.transfer(_to, ZunBal);
        } else {
            transferSuccess = Zun.transfer(_to, _amount);
        }
        require(transferSuccess, 'safeZunTransfer: Transfer failed');
    }
}
