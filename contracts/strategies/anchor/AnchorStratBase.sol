//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../interfaces/IZunami.sol';
import './IConversionPool.sol';
import './IExchangeRateFeeder.sol';

contract AnchorStratBase is Ownable {
    using SafeERC20 for IERC20Metadata;

    enum WithdrawalType {
        Base,
        OneCoin
    }

    struct Config {
        IERC20Metadata[3] tokens;
        IERC20Metadata[3] aTokens;
        IConversionPool[3] aTokenPools;
    }

    Config internal _config;

    IZunami public zunami;

    uint256 public constant PRICE_DENOMINATOR = 1e18;
    uint256 public constant DEPOSIT_DENOMINATOR = 10000;
    uint256 public constant ZUNAMI_DAI_TOKEN_ID = 0;
    uint256 public constant ZUNAMI_USDC_TOKEN_ID = 1;
    uint256 public constant ZUNAMI_USDT_TOKEN_ID = 2;

    uint256 public minDepositAmount = 9975; // 99.75%
    address public feeDistributor;

    uint256[3] public managementFees;

    uint256[3] public decimalsMultipliers;

    event SoldRewards(uint256 cvxBalance, uint256 crvBalance, uint256 extraBalance);

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        require(_msgSender() == address(zunami), 'must be called by Zunami contract');
        _;
    }

    constructor(Config memory config_) {
        _config = config_;

        for (uint256 i; i < 3; i++) {
            decimalsMultipliers[i] = calcTokenDecimalsMultiplier(_config.tokens[i]);
        }

        feeDistributor = _msgSender();
    }

    /**
     * @dev Returns deposited amount in USD.
     * If deposit failed return zero
     * @return Returns deposited amount in USD.
     * @param amounts - amounts in stablecoins that user deposit
     */
    function deposit(uint256[3] memory amounts) external returns (uint256) {
        for (uint256 i = 0; i < 3; i++) {
            _config.tokens[i].safeIncreaseAllowance(address(_config.aTokenPools[i]), amounts[i]);
            _config.aTokenPools[i].deposit(amounts[i]);
        }

        return totalHoldings();
    }

    function transferAllTokensOut(address withdrawer) internal {
        uint256 transferAmount;
        for (uint256 i = 0; i < 3; i++) {
            uint256 tokenStratBalance = _config.tokens[i].balanceOf(address(this));
            require( tokenStratBalance > managementFees[i], "Zunami: Not enough strategy balance");
            unchecked {
                transferAmount = tokenStratBalance - managementFees[i];
            }
            if (transferAmount > 0) {
                _config.tokens[i].safeTransfer(withdrawer, transferAmount);
            }
        }
    }

    function transferZunamiAllTokens() internal {
        uint256 transferAmount;
        for (uint256 i = 0; i < 3; i++) {
            transferAmount = _config.tokens[i].balanceOf(address(this)) - managementFees[i];
            if (transferAmount > 0) {
                _config.tokens[i].safeTransfer(_msgSender(), transferAmount);
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
        uint256[3] memory tokenAmounts,
        WithdrawalType withdrawalType,
        uint128 tokenIndex
    ) external virtual onlyZunami returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= 1e18, 'Wrong lp Ratio');
        require(withdrawalType == WithdrawalType.Base, 'Only base');

        for (uint256 i = 0; i < 3; i++) {
            uint256 removingATokenBalance = (_config.aTokens[i].balanceOf(address(this)) *
                userRatioOfCrvLps) / 1e18;
            _config.aTokens[i].safeIncreaseAllowance(
                address(_config.aTokenPools[i]),
                removingATokenBalance
            );
            _config.aTokenPools[i].redeem(removingATokenBalance, tokenAmounts[i]);
        }

        transferAllTokensOut(withdrawer);

        return true;
    }

    function calcTokenDecimalsMultiplier(IERC20Metadata token) internal view returns (uint256) {
        uint8 decimals = token.decimals();
        require(decimals <= 18, 'Zunami: wrong token decimals');
        if (decimals == 18) return 1;
        return 10**(18 - decimals);
    }

    function autoCompound() public onlyZunami {
        // Calcs automaticly
    }

    /**
     * @dev Returns total USD holdings in strategy.
     * return amount is lpBalance x lpPrice + cvx x cvxPrice + _config.crv * crvPrice.
     * @return Returns total USD holdings in strategy
     */
    function totalHoldings() public view virtual returns (uint256) {
        uint256 tokensHoldings = 0;
        for (uint256 i = 0; i < 3; i++) {
            IExchangeRateFeeder feeder = IExchangeRateFeeder(_config.aTokenPools[i].feeder());
            uint256 pER = feeder.exchangeRateOf(address(_config.tokens[i]), false);
            tokensHoldings +=
                ((_config.aTokens[i].balanceOf(address(this)) * pER) / 1e18) *
                decimalsMultipliers[i];
        }

        return tokensHoldings;
    }

    function accrueManagementFees(uint256[3] memory newManagementFees) public onlyOwner {
        for (uint256 i = 0; i < 3; i++) {
            managementFees[i] += newManagementFees[i];
        }
    }

    /**
     * @dev dev claim managementFees from strategy.
     * when tx completed managementFees = 0
     */
    function claimManagementFees() public returns (uint256 totalClaimedFees) {
        for (uint256 i = 0; i < 3; i++) {
            uint256 tokenBalance = _config.tokens[i].balanceOf(address(this));
            uint256 transferBalance = managementFees[i] > tokenBalance ? tokenBalance : managementFees[i];
            totalClaimedFees += transferBalance * decimalsMultipliers[i];
            if (transferBalance > 0) {
                _config.tokens[i].safeTransfer(feeDistributor, transferBalance);
            }
            managementFees[i] = 0;
        }

        return totalClaimedFees;
    }

    /**
     * @dev dev can update minDepositAmount but it can't be higher than 10000 (100%)
     * If user send deposit tx and get deposit amount lower than minDepositAmount than deposit tx failed
     * @param _minDepositAmount - amount which must be the minimum (%) after the deposit, min amount 1, max amount 10000
     */
    function updateMinDepositAmount(uint256 _minDepositAmount) public onlyOwner {
        require(_minDepositAmount > 0 && _minDepositAmount <= 10000, 'Wrong amount!');
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
