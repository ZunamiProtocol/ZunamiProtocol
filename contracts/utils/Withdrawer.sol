//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Withdrawer is Ownable {
    using SafeERC20 for IERC20;

  function withdraw(
    address _token,
    uint256 _amount,
    address _to
  ) public onlyOwner {
    require(_token != address(0), "TOKEN");
    require(_amount > 0, "AMOUNT");
    require(_to != address(0), "TO");

    IERC20(_token).safeTransfer(_to, _amount);
  }

  function deposit(uint256[3] memory amounts) external returns(bool) {
      //do nothing
      return true;
  }
}
