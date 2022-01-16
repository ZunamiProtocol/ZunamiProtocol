//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IVeZunToken {
    function mint(address _to, uint256 amount) external;

    function burn(uint256 amount) external;
}
