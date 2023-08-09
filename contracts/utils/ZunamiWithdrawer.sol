//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IStrategy {
    function withdrawAll() external;
}

contract ZunamiWithdrawer is Ownable {

    function calcManagementFee(uint256 amount) external view returns (uint256) {
        return 0;
    }

    function withdrawAll(address strategy) external onlyOwner {
        IStrategy(strategy).withdrawAll();
    }

    function withdrawStuckToken(IERC20 _token) external onlyOwner {
        uint256 tokenBalance = _token.balanceOf(address(this));
        if (tokenBalance > 0) {
            _token.transfer(owner(), tokenBalance);
        }
    }
}
