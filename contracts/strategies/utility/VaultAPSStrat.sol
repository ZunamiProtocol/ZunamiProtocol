//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

contract VaultAPSStrat is Ownable {
    using SafeERC20 for IERC20Metadata;

    uint256 public constant PRICE_DENOMINATOR = 1e18;

    address public zunami;
    IERC20Metadata token;

    /**
     * @dev Throws if called by any account other than the Zunami
     */
    modifier onlyZunami() {
        require(msg.sender == zunami, 'must be called by Zunami contract');
        _;
    }

    constructor(IERC20Metadata _token) {
        token = _token;
    }

    function withdrawAll() external onlyZunami {
        transferAllTokensTo(zunami);
    }

    function transferAllTokensTo(address withdrawer) internal {
        uint256 tokenStratBalance = token.balanceOf(address(this));
        if (tokenStratBalance > 0) {
            token.safeTransfer(withdrawer, tokenStratBalance);
        }
    }

    /**
     * @dev Returns deposited amount.
     * If deposit failed return zero
     * @return Returns deposited amount.
     * @param amount - amount in stablecoin that user deposit
     */
    function deposit(uint256 amount) external returns (uint256) {
        return amount;
    }

    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256
    ) external virtual onlyZunami returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= PRICE_DENOMINATOR, 'Wrong lp Ratio');

        transferPortionTokensTo(withdrawer, userRatioOfCrvLps);

        return true;
    }

    function transferPortionTokensTo(address withdrawer, uint256 userRatioOfCrvLps) internal {
        uint256 transferAmountOut = (token.balanceOf(address(this)) * userRatioOfCrvLps) / PRICE_DENOMINATOR;
        if (transferAmountOut > 0) {
            token.safeTransfer(withdrawer, transferAmountOut);
        }
    }

    function autoCompound() public onlyZunami {}

    /**
     * @dev Returns total USD holdings in strategy.
     * @return Returns total USD holdings in strategy
     */
    function totalHoldings() public view virtual returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev dev set Zunami (main contract) address
     * @param zunamiAddr - address of main contract (Zunami)
     */
    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = zunamiAddr;
    }

    function claimManagementFees() external returns (uint256) {
        return 0;
    }
}
