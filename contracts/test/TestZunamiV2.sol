//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../ZunamiUpgradeable.sol";

contract TestZunamiUpgradeableV2 is ZunamiUpgradeable {
    uint256 public constant VERSION = 2;

    function version() public view returns(uint256){
        return VERSION;
    }
}
