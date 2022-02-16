//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ICurvePoolPricable {
    function get_virtual_price() external view returns (uint256);
}
