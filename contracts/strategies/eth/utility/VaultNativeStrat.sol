//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

contract VaultNativeStrat is Ownable {
    using SafeERC20 for IERC20Metadata;

    enum WithdrawalType {
        Base,
        OneCoin
    }

    uint256 public constant PRICE_DENOMINATOR = 1e18;

    uint8 public constant POOL_ASSETS = 5;
    uint8 public constant STRATEGY_ASSETS = 3;

    address public constant ETH_MOCK_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 public managementFees = 0;

    address public zunami;
    IERC20Metadata[STRATEGY_ASSETS] public tokens;

    modifier onlyZunami() {
        require(_msgSender() == zunami, 'must be called by Zunami contract');
        _;
    }

    constructor(IERC20Metadata[STRATEGY_ASSETS] memory _tokens) {
        tokens = _tokens;
    }

    receive() external payable {
        // receive ETH after unwrap
    }

    function withdrawAll() external onlyZunami {
        transferAllTokensTo(zunami);
    }

    function transferAllTokensTo(address withdrawer) internal {
        uint256 tokenStratBalance;
        IERC20Metadata token_;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            token_ = tokens[i];
            tokenStratBalance = balanceOfNative(token_);
            if (tokenStratBalance > 0) {
                safeTransferNative(token_, withdrawer, tokenStratBalance);
            }
        }
    }

    function deposit(uint256[POOL_ASSETS] memory amounts) external payable returns (uint256) {
        uint256 depositedAmount;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            if (amounts[i] > 0) {
                depositedAmount += amounts[i];
            }
        }

        return depositedAmount;
    }

    function withdraw(
        address withdrawer,
        uint256 userRatioOfCrvLps, // multiplied by 1e18
        uint256[POOL_ASSETS] memory,
        WithdrawalType withdrawalType,
        uint128
    ) external virtual onlyZunami returns (bool) {
        require(userRatioOfCrvLps > 0 && userRatioOfCrvLps <= PRICE_DENOMINATOR, 'Wrong lp Ratio');
        require(withdrawalType == WithdrawalType.Base, 'Only base');

        transferPortionTokensTo(withdrawer, userRatioOfCrvLps);

        return true;
    }

    function transferPortionTokensTo(address withdrawer, uint256 userRatioOfCrvLps) internal {
        uint256 transferAmountOut;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            transferAmountOut = (balanceOfNative(tokens[i]) * userRatioOfCrvLps) / 1e18;
            if (transferAmountOut > 0) {
                safeTransferNative(tokens[i], withdrawer, transferAmountOut);
            }
        }
    }

    function autoCompound() public onlyZunami returns (uint256) {
        return 0;
    }

    function totalHoldings() public view virtual returns (uint256) {
        uint256 tokensHoldings = 0;
        for (uint256 i = 0; i < STRATEGY_ASSETS; i++) {
            tokensHoldings += balanceOfNative(tokens[i]);
        }
        return tokensHoldings;
    }

    function renounceOwnership() public view override onlyOwner {
        revert('The strategy must have an owner');
    }

    function setZunami(address zunamiAddr) external onlyOwner {
        zunami = zunamiAddr;
    }

    function claimManagementFees() external returns (uint256) {
        return 0;
    }

    function balanceOfNative(IERC20Metadata token_) internal view returns (uint256) {
        if (address(token_) == ETH_MOCK_ADDRESS) {
            return address(this).balance;
        } else {
            return token_.balanceOf(address(this));
        }
    }

    function safeTransferNative(
        IERC20Metadata token,
        address receiver,
        uint256 amount
    ) internal {
        if (address(token) == ETH_MOCK_ADDRESS) {
            receiver.call{ value: amount }(''); // don't fail if user contract doesn't accept ETH
        } else {
            token.safeTransfer(receiver, amount);
        }
    }
}
