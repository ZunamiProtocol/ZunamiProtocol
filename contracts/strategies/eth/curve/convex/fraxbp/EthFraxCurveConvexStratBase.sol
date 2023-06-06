//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../../../../utils/Constants.sol';
import '../../../../../interfaces/IZunami.sol';
import '../../../../../interfaces/IRewardManagerNative.sol';
import '../../../../interfaces/ICurvePool2Native.sol';
import '../../../../../interfaces/IWETH.sol';

//import "hardhat/console.sol";

abstract contract FraxEthCurveConvexStratBase is Context, Ownable {
    using SafeERC20 for IERC20Metadata;

    uint8 public constant POOL_ASSETS = 5;
    uint8 public constant STRATEGY_ASSETS = 3;

    enum WithdrawalType {
        Base,
        OneCoin
    }

    struct Config {
        IERC20Metadata[STRATEGY_ASSETS] tokens;
        IERC20Metadata[] rewards;
        IConvexStakingBooster booster;
    }

    Config internal _config;

    IZunami public zunami;
    IRewardManagerNative public rewardManager;

    uint256 public constant CURVE_PRICE_DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;
    uint256 public constant ZUNAMI_ETH_TOKEN_ID = 0;
    uint256 public constant ZUNAMI_wETH_TOKEN_ID = 1;
    uint256 public constant ZUNAMI_frxETH_TOKEN_ID = 2;

    uint256 private constant ETH_frxETH_POOL_ETH_ID = 0;
    uint256 private constant ETH_frxETH_POOL_frxETH_ID = 1;
    int128 private constant iETH_frxETH_POOL_ETH_ID = 0;
    int128 private constant iETH_frxETH_POOL_frxETH_ID = 1;

    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 public minDepositAmount = 9975; // 99.75%
    address public feeDistributor;

    uint256 public managementFees = 0;
    uint256 public feeTokenId = ZUNAMI_wETH_TOKEN_ID; // only wETH linked with RewardManager

    uint256 public immutable cvxPoolPID;

    uint256[STRATEGY_ASSETS] public decimalsMultipliers;

    // fraxEthPool = ETH + frxETH => frxETHCRV
    ICurvePool2Native public immutable fraxEthPool;
    IERC20Metadata public immutable fraxEthPoolLp; // frxETHCRV

    IStakingProxyConvex public stakingVault;
    bytes32 public kekId;
    uint256 public constant lockingIntervalSec = 594000; // 6.875 * 86400 (~7 day)

    event SetRewardManager(address rewardManager);
    event MinDepositAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event FeeDistributorChanged(address oldFeeDistributor, address newFeeDistributor);
    event LockedLonger(uint256 newLockTimestamp);

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        require(_msgSender() == address(zunami), 'must be called by Zunami contract');
        _;
    }

    constructor(
        Config memory config_,
        address fraxEthPoolAddr,
        address fraxEthPoolLpAddr,
        uint256 poolPID
    ) {
        _config = config_;

        decimalsMultipliers[ZUNAMI_ETH_TOKEN_ID] = 1;
        for (uint256 i = ZUNAMI_wETH_TOKEN_ID; i < STRATEGY_ASSETS; i++) {
            decimalsMultipliers[i] = calcTokenDecimalsMultiplier(_config.tokens[i]);
        }

        cvxPoolPID = poolPID;
        feeDistributor = _msgSender();

        fraxEthPool = ICurvePool2Native(fraxEthPoolAddr);
        fraxEthPoolLp = IERC20Metadata(fraxEthPoolLpAddr);
    }

    receive() external payable {
        // receive ETH after unwrap
    }

    function config() external view returns (Config memory) {
        return _config;
    }

    function token() external view returns (address) {
        return fraxEthPool.coins(ETH_frxETH_POOL_frxETH_ID);
    }

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amounts - amounts in stablecoins that user deposit
     */
    function deposit(uint256[POOL_ASSETS] memory amounts) external payable returns (uint256) {
        if (!checkDepositSuccessful(amounts)) {
            return 0;
        }

        uint256 poolLPs = depositPool(amounts);

        return (poolLPs * getCurvePoolPrice()) / CURVE_PRICE_DENOMINATOR;
    }

    function getThisBalanceBy(IERC20Metadata token_) internal view returns (uint256) {
        if (address(token_) == ETH_MOCK_ADDRESS) {
            return address(this).balance;
        } else {
            return token_.balanceOf(address(this));
        }
    }

    function transferAllTokensOut(address withdrawer, uint256[] memory prevBalances) internal {
        uint256 feeTokenId_ = feeTokenId;
        uint256 managementFees_ = managementFees;
        uint256 transferAmount;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            IERC20Metadata token_ = _config.tokens[i];
            transferAmount =
            getThisBalanceBy(token_) -
            prevBalances[i] -
            ((i == feeTokenId_) ? managementFees_ : 0);
            if (transferAmount > 0) {
                if (i == ZUNAMI_ETH_TOKEN_ID) {
                    (bool sent, ) = withdrawer.call{ value: transferAmount }('');
                    require(sent, 'Failed to send Ether');
                } else {
                    token_.safeTransfer(withdrawer, transferAmount);
                }
            }
        }
    }

    function transferZunamiAllTokens() internal {
        uint256 feeTokenId_ = feeTokenId;
        uint256 managementFees_ = managementFees;

        uint256 transferAmount;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            IERC20Metadata token_ = _config.tokens[i];
            uint256 managementFee = (i == feeTokenId_) ? managementFees_ : 0;
            transferAmount = getThisBalanceBy(token_) - managementFee;
            if (transferAmount > 0) {
                if (i == ZUNAMI_ETH_TOKEN_ID) {
                    (bool sent, ) = _msgSender().call{ value: transferAmount }('');
                    require(sent, 'Failed to send Ether');
                } else {
                    token_.safeTransfer(_msgSender(), transferAmount);
                }
            }
        }
    }

    /**
     * @dev Returns true if withdraw success and false if fail.
     * Withdraw failed when user removingCrvLps < requiredCrvLPs (wrong minAmounts)
     * @return Returns true if withdraw success and false if fail.
     * @param withdrawer - address of user that deposit funds
     * @param userRatioOfCrvLps - user's Ratio of ZLP for withdraw
     * @param tokenAmounts -  array of amounts stablecoins that user want minimum receive
     */
    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[POOL_ASSETS] memory tokenAmounts,
        WithdrawalType withdrawalType,
        uint128 tokenIndex
    ) external virtual onlyZunami returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= 1e18, 'Wrong lp Ratio');
        (bool success, uint256 removingCrvLps, uint256[] memory tokenAmountsDynamic) = calcCrvLps(
            withdrawalType,
            userRatioOfCrvLps,
            tokenAmounts,
            tokenIndex
        );

        if (!success) {
            return false;
        }

        uint256[] memory prevBalances = new uint256[](STRATEGY_ASSETS);
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            prevBalances[i] =
            getThisBalanceBy(_config.tokens[i]) -
            ((i == feeTokenId) ? managementFees : 0);
        }

        // withdraw all crv lps
        releaseCurveLp();

        // stake back other curve lps
        stakeCurveLp(fraxEthPoolLp.balanceOf(address(this)) - removingCrvLps);

        removeCrvLps(removingCrvLps, tokenAmountsDynamic, withdrawalType, tokenAmounts, tokenIndex);

        transferAllTokensOut(withdrawer, prevBalances);

        return true;
    }

    function calcTokenDecimalsMultiplier(IERC20Metadata _token) internal view returns (uint256) {
        uint8 decimals = _token.decimals();
        require(decimals <= 18, 'Zunami: wrong token decimals');
        if (decimals == 18) return 1;
        unchecked {
            return 10**(18 - decimals);
        }
    }

    /**
     * @dev anyone can sell rewards, func do nothing if config crv&cvx balance is zero
     */
    function sellRewards() internal virtual {
        uint256 rewardsLength_ = _config.rewards.length;
        uint256[] memory rewardBalances = new uint256[](rewardsLength_);
        bool allRewardsEmpty = true;

        for (uint256 i = 0; i < rewardsLength_; i++) {
            uint256 rewardBalance_ = _config.rewards[i].balanceOf(address(this));
            rewardBalances[i] = rewardBalance_;
            if (rewardBalance_ > 0) {
                allRewardsEmpty = false;
            }
        }
        if (allRewardsEmpty) {
            return;
        }

        IERC20Metadata feeToken_ = _config.tokens[feeTokenId];
        uint256 feeTokenBalanceBefore = feeToken_.balanceOf(address(this));

        IRewardManagerNative rewardManager_ = rewardManager;
        IERC20Metadata rewardToken_;
        for (uint256 i = 0; i < rewardsLength_; i++) {
            uint256 rewardBalance_ = rewardBalances[i];
            if (rewardBalance_ == 0) continue;
            rewardToken_ = _config.rewards[i];
            rewardToken_.safeTransfer(address(rewardManager_), rewardBalance_);
            rewardManager_.handle(address(rewardToken_), rewardBalance_, true);
        }

        uint256 feeTokenBalanceAfter = feeToken_.balanceOf(address(this));

        managementFees += zunami.calcManagementFee(feeTokenBalanceAfter - feeTokenBalanceBefore);
    }

    function autoCompound() external onlyZunami returns (uint256) {
        if (address(stakingVault) == address(0)) return 0;

        try stakingVault.getReward(true) {} catch {
            stakingVault.getReward(false);
        }

        sellRewards();

        uint256 feeTokenId_ = feeTokenId;
        uint256 feeTokenBalance = _config.tokens[feeTokenId_].balanceOf(address(this)) -
        managementFees;

        uint256[POOL_ASSETS] memory amounts;
        amounts[feeTokenId_] = feeTokenBalance;

        if (feeTokenBalance > 0) depositPool(amounts);

        return feeTokenBalance * decimalsMultipliers[feeTokenId];
    }

    /**
     * @dev Returns total USD holdings in strategy.
     * return amount is lpBalance x lpPrice + cvx x cvxPrice + _config.crv * crvPrice.
     * @return Returns total USD holdings in strategy
     */
    function totalHoldings() external view virtual returns (uint256) {
        uint256 crvLpHoldings;
        uint256 rewardEarningInFeeToken;
        uint256 feeTokenId_ = feeTokenId;
        if (address(stakingVault) != address(0)) {
            crvLpHoldings =
            (stakingVault.stakingAddress().lockedLiquidityOf(address(stakingVault)) *
                getCurvePoolPrice()) /
            CURVE_PRICE_DENOMINATOR;

            (address[] memory tokenAddresses, uint256[] memory totalEarned) = stakingVault.earned();

            IRewardManagerNative rewardManager_ = rewardManager;
            for (uint256 i = 0; i < tokenAddresses.length; i++) {
                uint256 amountIn = totalEarned[i] +
                IERC20Metadata(tokenAddresses[i]).balanceOf(address(this));
                if (amountIn == 0) continue;
                rewardEarningInFeeToken += rewardManager_.valuate(tokenAddresses[i], amountIn);
            }
        }

        uint256 tokensHoldings = 0;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            tokensHoldings += getThisBalanceBy(_config.tokens[i]) * decimalsMultipliers[i];
        }

        return
        tokensHoldings +
        crvLpHoldings +
        rewardEarningInFeeToken *
        decimalsMultipliers[feeTokenId_];
    }

    /**
     * @dev dev claim managementFees from strategy.
     * when tx completed managementFees = 0
     */
    function claimManagementFees() external returns (uint256) {
        IERC20Metadata feeToken_ = _config.tokens[feeTokenId];
        uint256 managementFees_ = managementFees;
        uint256 feeTokenBalance = feeToken_.balanceOf(address(this));
        uint256 transferBalance = managementFees_ > feeTokenBalance
            ? feeTokenBalance
            : managementFees_;
        if (transferBalance > 0) {
            feeToken_.safeTransfer(feeDistributor, transferBalance);
        }
        managementFees = 0;

        return transferBalance;
    }

    /**
     * @dev dev can update minDepositAmount but it can't be higher than 10000 (100%)
     * If user send deposit tx and get deposit amount lower than minDepositAmount than deposit tx failed
     * @param _minDepositAmount - amount which must be the minimum (%) after the deposit, min amount 1, max amount 10000
     */
    function updateMinDepositAmount(uint256 _minDepositAmount) external onlyOwner {
        require(_minDepositAmount > 0 && _minDepositAmount <= 10000, 'Wrong amount!');
        emit MinDepositAmountUpdated(minDepositAmount, _minDepositAmount);
        minDepositAmount = _minDepositAmount;
    }

    /**
     * @dev disable renounceOwnership for safety
     */
    function renounceOwnership() public view override onlyOwner {
        revert('The strategy must have an owner');
    }

    /**
     * @dev dev set Zunami (main contract) address
     * @param zunamiAddr - address of main contract (Zunami)
     */
    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = IZunami(zunamiAddr);
    }

    function setRewardManager(address rewardManagerAddr) external onlyOwner {
        rewardManager = IRewardManagerNative(rewardManagerAddr);
        emit SetRewardManager(rewardManagerAddr);
    }

    function setFeeTokenId(uint256 feeTokenIdParam) external onlyOwner {
        feeTokenId = feeTokenIdParam;
    }

    /**
     * @dev governance can withdraw all stuck funds in emergency case
     * @param _token - IERC20Metadata token that should be fully withdraw from Strategy
     */
    function withdrawStuckToken(IERC20Metadata _token) external onlyOwner {
        uint256 tokenBalance = getThisBalanceBy(_token);
        if (tokenBalance > 0) {
            if (address(_token) == ETH_MOCK_ADDRESS) {
                (bool sent, ) = _msgSender().call{ value: tokenBalance }('');
                require(sent, 'Failed to send Ether');
            } else {
                _token.safeTransfer(_msgSender(), tokenBalance);
            }
        }
    }

    /**
     * @dev governance can set feeDistributor address for distribute protocol fees
     * @param _feeDistributor - address feeDistributor that be used for claim fees
     */
    function changeFeeDistributor(address _feeDistributor) external onlyOwner {
        emit FeeDistributorChanged(feeDistributor, _feeDistributor);
        feeDistributor = _feeDistributor;
    }

    function lockLonger() external onlyOwner {
        uint256 newLockTimestamp = block.timestamp + lockingIntervalSec;
        stakingVault.lockLonger(kekId, newLockTimestamp);
        emit LockedLonger(newLockTimestamp);
    }

    /**
     * @dev can be called by Zunami contract.
     * This function need for moveFunds between strategies.
     */
    function withdrawAll() external virtual onlyZunami {
        releaseCurveLp();

        try stakingVault.getReward(true) {} catch {
            stakingVault.getReward(false);
        }

        sellRewards();

        withdrawAllSpecific();

        transferZunamiAllTokens();
    }

    function checkDepositSuccessful(uint256[POOL_ASSETS] memory tokenAmounts)
    internal
    view
    returns (bool isValidDepositAmount)
    {
        uint256 amountsTotal;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            amountsTotal += tokenAmounts[i] * decimalsMultipliers[i];
        }

        uint256 amountsMin = (amountsTotal * minDepositAmount) / DEPOSIT_DENOMINATOR;

        uint256 lpPrice = getCurvePoolPrice();

        uint256[2] memory poolAmounts = convertZunamiTokensToPoolOnes(tokenAmounts);
        uint256 depositedLp = fraxEthPool.calc_token_amount(poolAmounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256[POOL_ASSETS] memory tokenAmounts)
    internal
    returns (uint256 crvFraxTokenLpAmount)
    {
        if (tokenAmounts[ZUNAMI_wETH_TOKEN_ID] > 0) {
            unwrapETH(tokenAmounts[ZUNAMI_wETH_TOKEN_ID]);
            tokenAmounts[ZUNAMI_ETH_TOKEN_ID] += tokenAmounts[ZUNAMI_wETH_TOKEN_ID];
        }

        uint256[2] memory amounts;
        amounts[ETH_frxETH_POOL_ETH_ID] = tokenAmounts[ZUNAMI_ETH_TOKEN_ID];
        amounts[ETH_frxETH_POOL_frxETH_ID] = tokenAmounts[ZUNAMI_frxETH_TOKEN_ID];

        _config.tokens[ZUNAMI_frxETH_TOKEN_ID].safeIncreaseAllowance(
            address(fraxEthPool),
            amounts[ETH_frxETH_POOL_frxETH_ID]
        );
        crvFraxTokenLpAmount = fraxEthPool.add_liquidity{ value: amounts[ETH_frxETH_POOL_ETH_ID] }(
            amounts,
            0
        );

        stakeCurveLp(crvFraxTokenLpAmount);
    }

    function stakeCurveLp(uint256 curveLpAmount) internal {
        if (address(stakingVault) == address(0)) {
            stakingVault = IStakingProxyConvex(_config.booster.createVault(cvxPoolPID));
        }

        fraxEthPoolLp.safeIncreaseAllowance(address(stakingVault), curveLpAmount);
        if (kekId == 0) {
            kekId = stakingVault.stakeLockedCurveLp(curveLpAmount, lockingIntervalSec);
        } else {
            stakingVault.lockAdditionalCurveLp(kekId, curveLpAmount);
        }
    }

    function releaseCurveLp() internal {
        stakingVault.withdrawLockedAndUnwrap(kekId);
        kekId = 0;
    }

    function getCurvePoolPrice() internal view returns (uint256) {
        return fraxEthPool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
    external
    view
    returns (uint256)
    {
        IStakingProxyConvex stakingVault_ = stakingVault;
        uint256 removingCrvLps = (stakingVault_.stakingAddress().lockedLiquidityOf(
            address(stakingVault_)
        ) * userRatioOfCrvLps) / 1e18;

        return
        fraxEthPool.calc_withdraw_one_coin(
            removingCrvLps,
            convertZunamiTokenIdToPoolOne(tokenIndex)
        );
    }

    function convertZunamiTokenIdToPoolOne(uint256 zunamiTokenId) internal pure returns (int128) {
        if (zunamiTokenId == ZUNAMI_ETH_TOKEN_ID || zunamiTokenId == ZUNAMI_wETH_TOKEN_ID) {
            return iETH_frxETH_POOL_ETH_ID;
        } else {
            return iETH_frxETH_POOL_frxETH_ID;
        }
    }

    function calcSharesAmount(uint256[POOL_ASSETS] memory tokenAmounts, bool isDeposit)
    external
    view
    returns (uint256)
    {
        uint256[2] memory amounts = convertZunamiTokensToPoolOnes(tokenAmounts);
        return fraxEthPool.calc_token_amount(amounts, isDeposit);
    }

    function convertZunamiTokensToPoolOnes(uint256[POOL_ASSETS] memory tokenAmounts)
    internal
    pure
    returns (uint256[2] memory amounts)
    {
        amounts[ETH_frxETH_POOL_ETH_ID] =
        tokenAmounts[ZUNAMI_ETH_TOKEN_ID] +
        tokenAmounts[ZUNAMI_wETH_TOKEN_ID];
        amounts[ETH_frxETH_POOL_frxETH_ID] = tokenAmounts[ZUNAMI_frxETH_TOKEN_ID];
    }

    function calcCrvLps(
        WithdrawalType,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[POOL_ASSETS] memory tokenAmounts,
        uint128
    )
    internal
    view
    returns (
        bool success,
        uint256 removingCrvLps,
        uint256[] memory tokenAmountsDynamic
    )
    {
        IStakingProxyConvex stakingVault_ = stakingVault;
        removingCrvLps =
        (stakingVault_.stakingAddress().lockedLiquidityOf(address(stakingVault_)) *
            userRatioOfCrvLps) /
        1e18;

        uint256[2] memory minAmounts = convertZunamiTokensToPoolOnes(tokenAmounts);
        success = removingCrvLps >= fraxEthPool.calc_token_amount(minAmounts, false);

        tokenAmountsDynamic = new uint256[](2);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256[] memory,
        WithdrawalType withdrawalType,
        uint256[POOL_ASSETS] memory tokenAmounts,
        uint128 tokenIndex
    ) internal {
        if (withdrawalType == WithdrawalType.Base) {
            fraxEthPool.remove_liquidity(removingCrvLps, [uint256(0), 0]);
        } else {
            int128 poolTokenIndex = convertZunamiTokenIdToPoolOne(tokenIndex);
            uint256[2] memory minAmounts = convertZunamiTokensToPoolOnes(tokenAmounts);
            fraxEthPool.remove_liquidity_one_coin(
                removingCrvLps,
                poolTokenIndex,
                minAmounts[uint256(int256(poolTokenIndex))]
            );
        }
    }

    function withdrawAllSpecific() internal {
        fraxEthPool.remove_liquidity(fraxEthPoolLp.balanceOf(address(this)), [uint256(0), 0]);
    }

    function unwrapETH(uint256 amount) internal {
        IWETH(payable(address(_config.tokens[ZUNAMI_wETH_TOKEN_ID]))).withdraw(amount);
    }
}
