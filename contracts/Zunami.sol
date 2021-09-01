//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./helpers/Constants.sol";
import "./interfaces/IERC20Extended.sol";
import "./interfaces/IStrategy.sol";

contract Zunami is Ownable {
    IERC20Extended lpToken;
    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public assets;
    address public currentStrategy;

    event Deposited(uint256[] calldatas, uint256 lpShares);
    event Withdrawn(uint256[] calldatas, uint256 lpShares);
    event StrategyUpdated(address newStrategy);

    constructor(address lpAddr) {
        assets[0] = Constants.DAI_ADDRESS;
        assets[1] = Constants.USDC_ADDRESS;
        assets[2] = Constants.USDT_ADDRESS;
        lpToken = IERC20Extended(lpAddr);
    }

    function setLPToken(address lpAddr) external onlyOwner {
        lpToken = IERC20Extended(lpAddr);
    }

    function updateStrategy(address newcurrentStrategy) external onlyOwner {
        IStrategy(currentStrategy).withdrawAll();
        uint256[] memory amounts = new uint256[](POOL_ASSETS);
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            amounts[i] = IERC20(assets[i]).balanceOf(address(this));
        }
        IStrategy(newcurrentStrategy).deposit(amounts);
        currentStrategy = newcurrentStrategy;
        emit StrategyUpdated(newcurrentStrategy);
    }

    function deposit(uint256[] calldata amounts) external returns (uint256) {
        require(
            amounts.length == POOL_ASSETS,
            "Zunami: should have exactly pool assets"
        );
        uint256 totalValue = IStrategy(currentStrategy).getTotalValue();
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            sum += amounts[i];
        }
        uint256 lpShares = (sum * lpToken.totalSupply()) / totalValue;
        lpToken.mint(lpShares);
        IStrategy(currentStrategy).deposit(amounts);

        emit Deposited(amounts, lpShares);
        return lpShares;
    }

    function withdraw(uint256 lpShares, uint256[] calldata minAmounts)
        external
    {
        require(
            lpToken.balanceOf(_msgSender()) >= lpShares,
            "Zunami: not enough LP balance"
        );
        IStrategy(currentStrategy).withdraw(
            _msgSender(),
            lpShares,
            lpToken.totalSupply(),
            minAmounts
        );
        lpToken.burn(lpShares);
        emit Withdrawn(minAmounts, lpShares);
    }
}
