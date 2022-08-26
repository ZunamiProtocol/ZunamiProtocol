// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElasticVault.sol";

contract Uzd is ElasticVault {
    address public constant ZUNAMI = 0x2ffCC661011beC72e1A9524E12060983E74D14ce;

    constructor()
        ElasticERC20("UZD Zunami Stable", "UZD", ZUNAMI)
        ElasticVault(IERC20Metadata(ZUNAMI)) { }
}
