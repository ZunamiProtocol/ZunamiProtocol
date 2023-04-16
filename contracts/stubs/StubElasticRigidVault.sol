// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '../interfaces/IElasticRigidVault.sol';

contract StubElasticRigidVault is IElasticRigidVault {
    function lockedNominalRigid() external view returns (uint256) {
        return 0;
    }
}
