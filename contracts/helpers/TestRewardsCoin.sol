// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestRewardsCoin is ERC20 {
    using SafeERC20 for ERC20;

    address public owner;
    constructor() ERC20("Test Rewards Coin", "TRC")  {
        // mint 1,000,000 Reward coins for testing purposes
         _mint(msg.sender, 10000000000000000000000000);
        owner= msg.sender;
    }
}