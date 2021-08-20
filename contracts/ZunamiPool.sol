// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IConvexPool.sol";

contract ZunamiPool {
  address public basePool;
  uint256 public pid;
  address public lptoken;
  // token or eth ?
  address public stakeToken;
  mapping(address => uint256) public _balanceOf;

  constructor(address _stakeToken) {
    basePool = 0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    stakeToken = _stakeToken;
  }

  function withdrawLP() internal {

  }

  function depositLP(uint256 newpid) internal {

  }

  function rebalance(uint256 newpid) external {
    withdrawAllFromConvex();
    withdrawLP();
    depositLP(newpid);
    depositAllToConvex(newpid);
    pid = newpid;
  }

  function withdrawAllFromConvex() internal {
    IConvexPool(basePool).withdrawAll(pid);
  }

  function withdrawFromConvex(uint256 amount) internal {
    IConvexPool(basePool).withdraw(pid, amount);
  }

  function depositAllToConvex(uint256 newpid) internal {
    (lptoken,,,,,) = IConvexPool(basePool).poolInfo(newpid);
    IERC20(lptoken).approve(basePool, IERC20(lptoken).balanceOf(address(this)));
    IConvexPool(basePool).depositAll(newpid, true);
  }

  function deposit(uint256 amount) external {
    IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);
    depositLP(pid);
    depositAllToConvex(pid);
  }
}
