//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../interfaces/IElasticRigidVault.sol';

//import "hardhat/console.sol";

abstract contract RewardSplitter {
    using SafeERC20 for IERC20Metadata;

    IERC20Metadata public immutable zlp;
    IElasticRigidVault public immutable zstable;
    address public immutable collector;

    constructor(
        address zlpAddr,
        address zstableAddr,
        address collectorAddr
    ) {
        require(zlpAddr != address(0), 'lp');
        zlp = IERC20Metadata(zlpAddr);

        require(zstableAddr != address(0), 'stable');
        zstable = IElasticRigidVault(zstableAddr);

        require(collectorAddr != address(0), 'collector');
        collector = collectorAddr;
    }

    function split(
        address token,
        uint256 amount
    ) public returns(uint256) {
        return extractRigidPart(token, amount);
    }

    function extractRigidPart(address reward, uint256 amount) internal returns (uint256) {
        uint256 zlpSupply = zlp.totalSupply();
        uint256 zlpLocked = zstable.lockedNominalRigid();

        uint256 rewardLocked = (amount * zlpLocked) / zlpSupply;
        if (rewardLocked > 0) {
            IERC20Metadata(reward).safeTransfer(collector, rewardLocked);
        }

        return amount - rewardLocked;
    }
}
