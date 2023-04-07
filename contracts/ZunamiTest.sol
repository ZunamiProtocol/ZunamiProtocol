//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './Zunami.sol';

contract ZunamiTest is Zunami {
    constructor() Zunami() {}

    function clearPools() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_poolInfo.length > 0, 'The array of pools is empty');

        delete _poolInfo;
    }
}
