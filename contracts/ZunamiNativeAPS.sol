//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ZunamiBaseAPS.sol";

contract ZunamiNativeAPS is ZunamiBaseAPS {

    address public constant zETH = 0xe47f1CD2A37c6FE69e3501AE45ECA263c5A87b2b;

    constructor() ZunamiBaseAPS(zETH, 'Zunami ETH APS LP', 'ethZAPSLP') { }
}
