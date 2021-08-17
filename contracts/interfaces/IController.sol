//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IController {

    function withdraw(address, uint256) external;

    function balanceOf(address) external view returns (uint256);

    function earn(address, uint256) external;
}
