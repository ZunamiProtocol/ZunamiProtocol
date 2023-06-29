//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../CurveConvexExtraNativeApsStratBase.sol';
import '../../../../../utils/Constants.sol';
import '../../../../interfaces/ICurvePool2.sol';
import '../../../../../interfaces/IStrategy.sol';
import "../../../../../interfaces/IZunamiNativeVault.sol";
import "../../../../../interfaces/IZunamiStableVault.sol";
import "../../../../interfaces/ICurvePool2Native.sol";

//import "hardhat/console.sol";

abstract contract FrxEthCurveConvexApsStratBase is CurveConvexExtraNativeApsStratBase {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant ZUNAMI_frxETH_TOKEN_ID = 2;
    uint128 public constant ZUNAMI_frxETH_TOKEN_ID_INT = 2;

    uint256 constant FRXETH_TOKEN_POOL_TOKEN_ID = 0;
    int128 constant FRXETH_TOKEN_POOL_TOKEN_ID_INT = 0;
    uint256 constant FRXETH_TOKEN_POOL_FRXETH_ID = 1;
    int128 constant FRXETH_TOKEN_POOL_FRXETH_ID_INT = 1;

    IZunamiNativeVault public immutable zunamiPool;
    IZunamiStableVault public immutable zunamiStable;

    // frxEthTokenPool = Token + frxEth
    ICurvePool2 public immutable frxEthTokenPool;
    IERC20Metadata public immutable frxEthTokenPoolLp;

    IERC20Metadata public immutable frxEth = IERC20Metadata(Constants.FRX_ETH_ADDRESS);

    constructor(
        Config memory config,
        address zunamiPoolAddr,
        address zunamiStableAddr,
        address frxEthTokenPoolAddr,
        address frxEthTokenPoolLpAddr,
        address rewardsAddr,
        uint256 poolPID,
        address tokenAddr,
        address extraRewardsAddr,
        address extraTokenAddr
    )
        CurveConvexExtraNativeApsStratBase(
            config,
            frxEthTokenPoolLpAddr,
            rewardsAddr,
            poolPID,
            tokenAddr,
            extraRewardsAddr,
            extraTokenAddr
        )
    {
        zunamiPool = IZunamiNativeVault(zunamiPoolAddr);
        zunamiStable = IZunamiStableVault(zunamiStableAddr);

        frxEthTokenPool = ICurvePool2(frxEthTokenPoolAddr);
        frxEthTokenPoolLp = IERC20Metadata(frxEthTokenPoolLpAddr);
    }

    function checkDepositSuccessful(uint256 tokenAmount)
        internal
        view
        override
        returns (bool isValidDepositAmount)
    {
        uint256 amountsMin = (tokenAmount * minDepositAmount) / DEPOSIT_DENOMINATOR;

        uint256[2] memory amounts;
        amounts[FRXETH_TOKEN_POOL_TOKEN_ID] = tokenAmount;

        uint256 lpPrice = frxEthTokenPool.get_virtual_price();
        uint256 depositedLp = frxEthTokenPool.calc_token_amount(amounts, true);

        isValidDepositAmount = (depositedLp * lpPrice) / CURVE_PRICE_DENOMINATOR >= amountsMin;
    }

    function depositPool(uint256 tokenAmount, uint256 frxEthAmount)
    internal
    override
    returns (uint256 poolLpAmount)
    {
        if(frxEthAmount > 0) {
            frxEth.safeIncreaseAllowance(address(frxEthTokenPool), frxEthAmount);
        }

        if(tokenAmount > 0) {
            token.safeIncreaseAllowance(address(frxEthTokenPool), tokenAmount);
        }

        uint256[2] memory tokenPoolAmounts;
        tokenPoolAmounts[FRXETH_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        tokenPoolAmounts[FRXETH_TOKEN_POOL_FRXETH_ID] = frxEthAmount;
        poolLpAmount = frxEthTokenPool.add_liquidity(tokenPoolAmounts, 0);

        frxEthTokenPoolLp.safeIncreaseAllowance(address(_config.booster), poolLpAmount);
        _config.booster.depositAll(cvxPoolPID, true);
    }

    function getCurvePoolPrice() internal view override returns (uint256) {
        return frxEthTokenPool.get_virtual_price();
    }

    function calcWithdrawOneCoin(uint256 userRatioOfCrvLps)
        external
        view
        override
        returns (uint256)
    {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;
        return frxEthTokenPool.calc_withdraw_one_coin(
            removingCrvLps,
            FRXETH_TOKEN_POOL_TOKEN_ID_INT
        );
    }

    function calcSharesAmount(uint256 tokenAmount, bool isDeposit)
        external
        view
        override
        returns (uint256)
    {
        uint256[2] memory tokenAmounts2;
        tokenAmounts2[FRXETH_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        return frxEthTokenPool.calc_token_amount(tokenAmounts2, isDeposit);
    }

    function calcCrvLps(
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256 tokenAmount
    )
        internal
        view
        override
        returns (
            bool success,
            uint256 removingCrvLps
        )
    {
        removingCrvLps = (cvxRewards.balanceOf(address(this)) * userRatioOfCrvLps) / 1e18;

        uint256[2] memory minAmounts;
        minAmounts[FRXETH_TOKEN_POOL_TOKEN_ID] = tokenAmount;
        success = removingCrvLps >= frxEthTokenPool.calc_token_amount(minAmounts, false);
    }

    function removeCrvLps(
        uint256 removingCrvLps,
        uint256 tokenAmount
    ) internal override {
        removeCrvLpsInternal(removingCrvLps, tokenAmount);
    }

    function removeCrvLpsInternal(uint256 removingCrvLps, uint256 minTokenAmount) internal {
        frxEthTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            FRXETH_TOKEN_POOL_TOKEN_ID_INT,
            minTokenAmount
        );
    }

    function withdrawAllSpecific() internal override {
        removeCrvLpsInternal(frxEthTokenPoolLp.balanceOf(address(this)), 0);
    }

    function sellToken() public {
        uint256 sellBal = token.balanceOf(address(this));
        if (sellBal > 0) {
            token.safeIncreaseAllowance(address(frxEthTokenPool), sellBal);
            frxEthTokenPool.exchange_underlying(0, 1, sellBal, 0);
        }
    }

    function inflate(uint256 ratioOfCrvLps, uint256 minInflatedAmount) external onlyOwner {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * ratioOfCrvLps) / 1e18;

        cvxRewards.withdrawAndUnwrap(removingCrvLps, false);

        uint256 frxEthAmount = frxEthTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            FRXETH_TOKEN_POOL_FRXETH_ID_INT,
            minInflatedAmount
        );

        IERC20Metadata(Constants.FRX_ETH_ADDRESS).safeIncreaseAllowance(address(zunamiPool), frxEthAmount);
        uint256 zlpAmount = zunamiPool.deposit([0,0,frxEthAmount,0,0]);

        IERC20Metadata(address(zunamiPool)).safeIncreaseAllowance(address(zunamiStable), zlpAmount);
        zunamiStable.deposit(zlpAmount, address(this));

        uint256 zstableAmount = IERC20Metadata(address(zunamiStable)).balanceOf(address(this));

        depositPool(zstableAmount, 0);
    }

    function deflate(uint256 ratioOfCrvLps, uint256 minDeflateAmount) external onlyOwner {
        uint256 removingCrvLps = (cvxRewards.balanceOf(address(this)) * ratioOfCrvLps) / 1e18;

        cvxRewards.withdrawAndUnwrap(removingCrvLps, false);

        uint256 tokenAmount = frxEthTokenPool.remove_liquidity_one_coin(
            removingCrvLps,
            FRXETH_TOKEN_POOL_TOKEN_ID_INT,
            0
        );

        IERC20Metadata(address(zunamiStable)).safeIncreaseAllowance(address(zunamiStable), tokenAmount);
        zunamiStable.withdraw(tokenAmount, address(this), address(this));

        uint256 zlpAmount = IERC20Metadata(address(zunamiPool)).balanceOf(address(this));

        IERC20Metadata(address(zunamiPool)).safeIncreaseAllowance(address(zunamiPool), zlpAmount);
        zunamiPool.withdraw(
            zlpAmount,
            [0, 0, minDeflateAmount, 0, 0],
            IStrategy.WithdrawalType.OneCoin,
            ZUNAMI_frxETH_TOKEN_ID_INT
        );

        uint256 frxEth = IERC20Metadata(Constants.FRX_ETH_ADDRESS).balanceOf(address(this));

        depositPool(0, frxEth - managementFees);
    }
}
