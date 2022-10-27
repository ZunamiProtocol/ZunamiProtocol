//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../utils/Constants.sol';

import '../../interfaces/IZunami.sol';
import '../../interfaces/ICurvePool.sol';

import './ISeniorPool.sol';
import './IStakingRewards.sol';
import "../../interfaces/IUniswapRouter.sol";

//import 'hardhat/console.sol';

/**
 * @title The strategy for working with the Goldfinch protocol
 */
contract GoldfinchStrat is Ownable {
    using SafeERC20 for IERC20Metadata;
    enum WithdrawalType {
        Base,
        OneCoin
    }

    struct Config {
        IERC20Metadata[3] tokens;
        ICurvePool curve3Pool;
        ISeniorPool seniorPool;
        IStakingRewards stakingRewards;
        IERC20Metadata gfi;
        IERC20Metadata fidu;
        IUniswapRouter router;
        address[] gfiToFeeTokenPath;
    }
    Config internal _config;

    IZunami public zunami;

    uint256 public constant UNISWAP_USD_MULTIPLIER = 1e12;
    uint256 public constant CURVE_PRICE_DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;

    uint256 public constant ZUNAMI_DAI_TOKEN_ID = 0;
    uint256 public constant ZUNAMI_USDC_TOKEN_ID = 1;
    uint256 public constant ZUNAMI_USDT_TOKEN_ID = 2;

    int128 public constant UNISWAP_USDC_TOKEN_ID = 1;

    address public feeDistributor;

    uint256 public managementFees = 0;
    uint256 public feeTokenId = ZUNAMI_USDC_TOKEN_ID;

    uint256 tokenId;

    uint256[3] public decimalsMultipliers;

    event SoldRewards(uint256 gfiBalance);

    error OnlyZunamiError(address zunami, address sender);
    error OperationsWithNullBalance(address token, uint256 balance);

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        if (_msgSender() != address(zunami)) {
            revert OnlyZunamiError(address(zunami), _msgSender());
        }
        _;
    }

    constructor(
        Config memory config
    ) {
        _config = config;

        for (uint256 i; i < 3; i++) {
            decimalsMultipliers[i] = calcTokenDecimalsMultiplier(_config.tokens[i]);
        }
    }

    /**
     * @notice Provide liquidity to the Goldfinch
     * @param amounts array of stablecoins where 0 - dai, 1 - usdc, 2 - usdt
     * @return Returns deposited amount.
     */
    function deposit(uint256[3] memory amounts) external returns (uint256) {
        //sell dai to usdc
        if (amounts[ZUNAMI_DAI_TOKEN_ID] != 0) {
            exchangeToUSDC(ZUNAMI_DAI_TOKEN_ID, amounts[ZUNAMI_DAI_TOKEN_ID]);
        }

        //sell usdt to usdc
        if (amounts[ZUNAMI_USDT_TOKEN_ID] != 0) {
            exchangeToUSDC(ZUNAMI_USDT_TOKEN_ID, amounts[ZUNAMI_USDT_TOKEN_ID]);
        }

        return depositAllUSDCExceptFee() * decimalsMultipliers[ZUNAMI_USDC_TOKEN_ID];
    }

    function depositAllUSDCExceptFee() internal returns(uint256 usdcBalance) {
        usdcBalance = _config.tokens[ZUNAMI_USDC_TOKEN_ID].balanceOf(address(this)) - managementFees;
        if(usdcBalance == 0) return 0;

        _config.tokens[ZUNAMI_USDC_TOKEN_ID].safeApprove(address(_config.seniorPool), usdcBalance);
        uint256 fiduBalance = _config.seniorPool.deposit(usdcBalance);

        _config.fidu.safeApprove(address(_config.stakingRewards), fiduBalance);

        if(tokenId == 0) {
            tokenId = _config.stakingRewards.stake(fiduBalance, StakedPositionType.Fidu);
        } else {
            _config.stakingRewards.addToStake(tokenId, fiduBalance);
        }
    }

    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[3] memory tokenAmounts,
        WithdrawalType withdrawalType,
        uint128 tokenIndex
    ) external returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= 1e18, 'Wrong lp Ratio');
        if(tokenId == 0) return false;
        uint256 fiduBalance = _config.stakingRewards.stakedBalanceOf(tokenId);
        uint256 removingFidu = fiduBalance * userRatioOfCrvLps / 1e18;

        uint256[] memory prevBalances = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            prevBalances[i] =
            _config.tokens[i].balanceOf(address(this)) -
            ((i == feeTokenId) ? managementFees : 0);
        }

        _config.stakingRewards.unstake(tokenId, removingFidu);
        _config.seniorPool.withdrawInFidu(removingFidu);

        if(withdrawalType == WithdrawalType.OneCoin && tokenIndex != ZUNAMI_USDC_TOKEN_ID) {
            exchangeFromUSDC(tokenIndex, _config.tokens[ZUNAMI_USDC_TOKEN_ID].balanceOf(address(this)) - managementFees);
        }

        transferAllTokensOut(withdrawer, prevBalances);

        return true;
    }

    function exchangeToUSDC(uint256 fromTokenId, uint256 amount) internal {
        _config.tokens[fromTokenId].safeApprove(address(_config.curve3Pool), amount);
        _config.curve3Pool.exchange(int128(uint128(fromTokenId)), UNISWAP_USDC_TOKEN_ID, amount, 0);
    }

    function exchangeFromUSDC(uint256 toTokenId, uint256 amount) internal {
        _config.tokens[ZUNAMI_USDC_TOKEN_ID].safeApprove(address(_config.curve3Pool), amount);
        _config.curve3Pool.exchange(UNISWAP_USDC_TOKEN_ID, int128(uint128(toTokenId)), amount, 0);
    }

    function withdrawAll() external {
        if(tokenId == 0) return;

        _config.stakingRewards.getReward(tokenId);
        sellRewards();

        uint256 fiduBalance = _config.stakingRewards.stakedBalanceOf(tokenId);
        _config.stakingRewards.unstake(tokenId, fiduBalance);
        _config.seniorPool.withdrawInFidu(fiduBalance);
        transferZunamiAllTokens();
    }

    function totalHoldings() external view returns (uint256) {
        if(tokenId == 0) return 0;
        uint256 fiduBalance = _config.stakingRewards.stakedBalanceOf(tokenId);

        uint256 gfiRewards = _config.stakingRewards.claimableRewards(tokenId);

        return
            (
                (fiduBalance * _config.seniorPool.sharePrice()) / 1e18 +
                _config.router.getAmountsOut(gfiRewards, _config.gfiToFeeTokenPath)[1]
            )
                * decimalsMultipliers[ZUNAMI_USDC_TOKEN_ID];
    }

    function claimManagementFees() public returns (uint256) {
        uint256 feeTokenBalance = _config.tokens[feeTokenId].balanceOf(address(this));
        uint256 transferBalance = managementFees > feeTokenBalance ? feeTokenBalance : managementFees;
        if (transferBalance > 0) {
            _config.tokens[feeTokenId].safeTransfer(feeDistributor, transferBalance);
        }
        managementFees = 0;

        return transferBalance;
    }

    function autoCompound() external {
        if(tokenId == 0) return;
        _config.stakingRewards.getReward(tokenId);

        sellRewards();

        depositAllUSDCExceptFee();
    }

    function sellRewards() public {
        uint256 gfiBalance = _config.gfi.balanceOf(address(this));
        if (gfiBalance == 0) {
            return;
        }
        _config.gfi.safeApprove(address(_config.router), gfiBalance);

        uint256 feeTokenBalanceBefore = _config.tokens[feeTokenId].balanceOf(address(this));

        _config.router.swapExactTokensForTokens(
            gfiBalance,
            0,
            _config.gfiToFeeTokenPath,
            address(this),
            block.timestamp + Constants.TRADE_DEADLINE
        );

        uint256 feeTokenBalanceAfter = _config.tokens[feeTokenId].balanceOf(address(this));

        managementFees += zunami.calcManagementFee(feeTokenBalanceAfter - feeTokenBalanceBefore);
        emit SoldRewards(gfiBalance);
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps, uint128 tokenIndex)
        external
        view
        returns (uint256 tokenAmount)
    {
        uint256 fiduBalance = _config.stakingRewards.stakedBalanceOf(tokenId) * userRatioOfCrvLps / 1e18;
        tokenAmount = fiduBalance * _config.seniorPool.sharePrice() / 1e18;
        if(tokenIndex != ZUNAMI_USDC_TOKEN_ID) {
            tokenAmount = _config.curve3Pool.get_dy(UNISWAP_USDC_TOKEN_ID, int128(uint128(tokenIndex)), tokenAmount);
        }
    }

    function calcSharesAmount(uint256[3] memory tokenAmounts, bool isDeposit)
        external
        view
        returns (uint256 sharesAmount)
    {
        sharesAmount = 0;
    }

    function calcTokenDecimalsMultiplier(IERC20Metadata token) internal view returns (uint256) {
        uint8 decimals = token.decimals();
        require(decimals <= 18, 'Zunami: wrong token decimals');
        if (decimals == 18) return 1;
        return 10**(18 - decimals);
    }

    function transferAllTokensOut(address withdrawer, uint256[] memory prevBalances) internal {
        uint256 transferAmount;
        for (uint256 i = 0; i < 3; i++) {
            transferAmount =
            _config.tokens[i].balanceOf(address(this)) -
            prevBalances[i] -
            ((i == feeTokenId) ? managementFees : 0);
            if (transferAmount > 0) {
                _config.tokens[i].safeTransfer(withdrawer, transferAmount);
            }
        }
    }

    function transferZunamiAllTokens() internal {
        uint256 transferAmount;
        for (uint256 i = 0; i < 3; i++) {
            uint256 managementFee = (i == feeTokenId) ? managementFees : 0;
            transferAmount = _config.tokens[i].balanceOf(address(this)) - managementFee;
            if (transferAmount > 0) {
                _config.tokens[i].safeTransfer(_msgSender(), transferAmount);
            }
        }
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
        feeDistributor = _feeDistributor;
    }
}
