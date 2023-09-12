//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './ZunamiV2.sol';

contract ZunamiTest is ZunamiV2 {
    constructor() ZunamiV2() {}

    function clearPools() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolInfo.length > 0, 'The array of pools is empty');

        delete _poolInfo;
    }
}
