//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ZunamiBaseAPS.sol";

contract ZunamiAPS is ZunamiBaseAPS{

    address public constant UZD = 0xb40b6608B2743E691C9B54DdBDEe7bf03cd79f1c;

    constructor() ZunamiBaseAPS(UZD, 'ZunamiAPSLP', 'ZAPSLP') { }
}
