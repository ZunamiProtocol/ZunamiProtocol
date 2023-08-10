//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "./IStrategy.sol";

interface IZunamiApsVault is IERC20 {
    function withdraw(
        uint256 lpShares,
        uint256 tokenAmount
    ) external;

    function deposit(uint256 amount) external returns (uint256);
}
