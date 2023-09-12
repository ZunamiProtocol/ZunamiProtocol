//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../../../utils/Constants.sol';
import '../../../../interfaces/IUniswapRouter.sol';
import '../../../../interfaces/IZunami.sol';

import '../../../interfaces/IRewardManager.sol';
import "../../../stable/curve/stakedao/interfaces/IStakeDaoVault.sol";

//import "hardhat/console.sol";

abstract contract CurveStakeDaoApsStratBase is Ownable {
    using SafeERC20 for IERC20Metadata;

    struct Config {
        IERC20Metadata token;
        IERC20Metadata[] rewards;
    }

    Config internal _config;

    IZunami public zunami;
    IRewardManager public rewardManager;

    uint256 public constant CURVE_PRICE_DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;

    uint256 public minDepositAmount = 9975; // 99.75%
    address public feeDistributor;

    uint256 public managementFees = 0;

    IStakeDaoVault public immutable vault;
    IERC20Metadata public immutable poolLP;

    event SetRewardManager(address rewardManager);
    event MinDepositAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event FeeDistributorChanged(address oldFeeDistributor, address newFeeDistributor);

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        require(_msgSender() == address(zunami), 'must be called by Zunami contract');
        _;
    }

    constructor(
        Config memory config_,
        address vaultAddr,
        address poolLPAddr
    ) {
        _config = config_;

        vault = IStakeDaoVault(vaultAddr);
        poolLP = IERC20Metadata(poolLPAddr);
        feeDistributor = _msgSender();
    }

    function config() external view returns (Config memory) {
        return _config;
    }

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amount - amounts in stablecoin that user deposit
     */
    function deposit(uint256 amount) external returns (uint256) {
        if (!checkDepositSuccessful(amount)) {
            return 0;
        }

        uint256 poolLPs = depositPool(amount, 0);

        return (poolLPs * getCurvePoolPrice()) / CURVE_PRICE_DENOMINATOR;
    }

    function checkDepositSuccessful(uint256 amount) internal view virtual returns (bool);

    function depositPool(uint256 tokenAmount, uint256 usdcAmount) internal virtual returns (uint256);

    function getCurvePoolPrice() internal view virtual returns (uint256);

    function transferAllTokensOut(address withdrawer, uint256 prevBalance) internal {
        uint256 transferAmount = _config.token.balanceOf(address(this)) - prevBalance;
        if (transferAmount > 0) {
            _config.token.safeTransfer(withdrawer, transferAmount);
        }
    }

    function transferZunamiAllTokens() internal {
        uint256 transferAmount = _config.token.balanceOf(address(this));
        if (transferAmount > 0) {
            _config.token.safeTransfer(_msgSender(), transferAmount);
        }
    }

    function calcWithdrawOneCoin(uint256 sharesAmount)
        external
        view
        virtual
        returns (uint256 tokenAmount);

    function calcSharesAmount(uint256 tokenAmount, bool isDeposit)
        external
        view
        virtual
        returns (uint256 sharesAmount);

    /**
     * @dev Returns true if withdraw success and false if fail.
     * Withdraw failed when user removingCrvLps < requiredCrvLPs (wrong minAmounts)
     * @return Returns true if withdraw success and false if fail.
     * @param withdrawer - address of user that deposit funds
     * @param userRatioOfCrvLps - user's Ratio of ZLP for withdraw
     * @param tokenAmount - amount stablecoin that user want minimum receive
     */
    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256 tokenAmount
    ) external virtual onlyZunami returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= 1e18, 'Wrong lp Ratio');
        (bool success, uint256 removingCrvLps) = calcCrvLps(
            userRatioOfCrvLps,
            tokenAmount
        );

        if (!success) {
            return false;
        }

        uint256 prevBalance = _config.token.balanceOf(address(this));

        vault.withdraw(removingCrvLps);

        removeCrvLps(removingCrvLps, tokenAmount);

        transferAllTokensOut(withdrawer, prevBalance);

        return true;
    }

    function calcCrvLps(
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256 tokenAmount
    )
        internal
        virtual
        returns (
            bool success,
            uint256 removingCrvLps
        );

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256 tokenAmount
    ) internal virtual;

    function calcTokenDecimalsMultiplier(IERC20Metadata token) internal view returns (uint256) {
        uint8 decimals = token.decimals();
        require(decimals <= 18, 'Zunami: wrong token decimals');
        if (decimals == 18) return 1;
        unchecked{
            return 10**(18 - decimals);
        }
    }

    /**
     * @dev anyone can sell rewards, func do nothing if config crv&sdt balance is zero
     */
    function sellRewards() internal virtual {
        uint256 rewardsLength_ = _config.rewards.length;
        uint256[] memory rewardBalances = new uint256[](rewardsLength_);
        bool allRewardsEmpty = true;

        for (uint256 i = 0; i < rewardsLength_; i++) {
            rewardBalances[i] = _config.rewards[i].balanceOf(address(this));
            if (rewardBalances[i] > 0) {
                allRewardsEmpty = false;
            }
        }
        if (allRewardsEmpty) {
            return;
        }

        IERC20Metadata feeToken_ = IERC20Metadata(Constants.USDC_ADDRESS);
        uint256 feeTokenBalanceBefore = feeToken_.balanceOf(address(this));

        IRewardManager rewardManager_ = rewardManager;
        IERC20Metadata rewardToken_;
        for (uint256 i = 0; i < rewardsLength_; i++) {
            if (rewardBalances[i] == 0) continue;
            rewardToken_ = _config.rewards[i];
            rewardToken_.transfer(address(rewardManager_), rewardBalances[i]);
            rewardManager_.handle(
                address(rewardToken_),
                rewardBalances[i],
                Constants.USDC_ADDRESS
            );
        }

        sellRewardsExtra();

        uint256 feeTokenBalanceAfter = feeToken_.balanceOf(address(this));

        managementFees += zunami.calcManagementFee(feeTokenBalanceAfter - feeTokenBalanceBefore);
    }

    function sellRewardsExtra() internal virtual {}

    function autoCompound() public onlyZunami {
        vault.liquidityGauge().claim_rewards();

        sellRewards();

        uint256 feeTokenBalance = IERC20Metadata(Constants.USDC_ADDRESS).balanceOf(address(this)) -
            managementFees;

        if (feeTokenBalance > 0) depositPool(0, feeTokenBalance);
    }

    /**
     * @dev Returns total USD holdings in strategy.
     * return amount is lpBalance x lpPrice + sdt x sdtPrice + _config.crv * crvPrice.
     * @return Returns total USD holdings in strategy
     */
    function totalHoldings() public view virtual returns (uint256) {

        uint256 crvLpHolding = (vault.liquidityGauge().balanceOf(address(this)) *
            getCurvePoolPrice()) / CURVE_PRICE_DENOMINATOR;

        uint256 rewardEarningInFeeToken;
        IERC20Metadata rewardToken_;
        IRewardManager rewardManager_ = rewardManager;
        for (uint256 i = 0; i < _config.rewards.length; i++) {
            rewardToken_ = _config.rewards[i];
            uint256 rewardTokenEarned = vault.liquidityGauge().claimable_reward(
                address(this),
                address(rewardToken_)
            );
            uint256 amountIn = rewardTokenEarned + rewardToken_.balanceOf(address(this));
            rewardEarningInFeeToken += rewardManager_.valuate(
                address(rewardToken_),
                amountIn,
                Constants.USDC_ADDRESS
            );
        }

        uint256 tokensHolding = _config.token.balanceOf(address(this));

        return
            tokensHolding +
            crvLpHolding +
            rewardEarningInFeeToken * (10**12); // USDC token multiplier 18 - 6
    }

    /**
     * @dev dev claim managementFees from strategy.
     * when tx completed managementFees = 0
     */
    function claimManagementFees() public returns (uint256) {
        IERC20Metadata feeToken_ = IERC20Metadata(Constants.USDC_ADDRESS);
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
    function updateMinDepositAmount(uint256 _minDepositAmount) public onlyOwner {
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
        rewardManager = IRewardManager(rewardManagerAddr);
        emit SetRewardManager(rewardManagerAddr);
    }

    /**
     * @dev governance can withdraw all stuck funds in emergency case
     * @param _token - IERC20Metadata token that should be fully withdraw from Strategy
     */
    function withdrawStuckToken(IERC20Metadata _token) external onlyOwner {
        uint256 tokenBalance = _token.balanceOf(address(this));
        if (tokenBalance > 0) {
            _token.safeTransfer(_msgSender(), tokenBalance);
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
}
