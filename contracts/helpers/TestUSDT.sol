// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestUSDT is ERC20 {
    using SafeERC20 for ERC20;

    address public owner;
    constructor() ERC20("Tether", "USDT")  {
        // mint 100,000 Tether coins for testing purposes
         _mint(msg.sender, 1000000000000000000000000);
        owner= msg.sender;
    }
}