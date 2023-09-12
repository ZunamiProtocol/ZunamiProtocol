//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IStrategy.sol';
import './IZunamiPoolInfo.sol';

interface IZunamiVaultV1 is IERC20, IZunamiPoolInfo {
    function defaultDepositPid() external view returns (uint256);

    function defaultWithdrawPid() external view returns (uint256);

    function withdraw(
        uint256 lpShares,
        uint256[3] memory tokenAmounts,
        IStrategy.WithdrawalType withdrawalType,
        uint128 tokenIndex
    ) external;

    function deposit(uint256[3] memory amounts) external returns (uint256);

    function calcWithdrawOneCoin(uint256 lpShares, uint128 tokenIndex)
        external
        view
        returns (uint256 tokenAmount);
}
