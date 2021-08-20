//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IConvexPool {
  function poolInfo(uint256 _pid) external view returns(address,address,address,address,address,bool);

  function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns(bool);

  function depositAll(uint256 _pid, bool _stake) external returns(bool);

  function withdraw(uint256 _pid, uint256 _amount) external returns(bool);

  function withdrawAll(uint256 _pid) external returns(bool);
}
