//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./helpers/Constants.sol";
import "./interfaces/IERC20Extended.sol";
import "./interfaces/IStrategy.sol";

contract Zunami is Ownable {
    IERC20Extended lp;
    uint8 private constant POOL_ASSETS = 3;

    address[POOL_ASSETS] public assets;
    address public optimalStrategy;

    event Deposited(uint256[] calldatas, uint256 lps);
    event Withdrawn(uint256[] calldatas, uint256 lps);
    event StrategyUpdated(address newStrategy);

    constructor(address lpAddr) {
        assets[0] = Constants.DAI_ADDRESS;
        assets[1] = Constants.USDC_ADDRESS;
        assets[2] = Constants.USDT_ADDRESS;
        lp = IERC20Extended(lpAddr);
    }

    function setLP(address newlp) external onlyOwner {
        lp = IERC20Extended(newlp);
    }

    function updateStrategy(address newOptimalStrategy) external onlyOwner {
        IStrategy(optimalStrategy).withdrawAll();
        uint256[] memory amounts = new uint256[](POOL_ASSETS);
        for (uint256 i = 0; i < POOL_ASSETS; ++i) {
            amounts[i] = IERC20(assets[i]).balanceOf(address(this));
        }
        IStrategy(newOptimalStrategy).deposit(amounts);
        optimalStrategy = newOptimalStrategy;
        emit StrategyUpdated(newOptimalStrategy);
    }

    function deposit(uint256[] calldata amounts) external returns (uint256) {
        require(
            amounts.length == POOL_ASSETS,
            "Zunami: should have exactly pool assets"
        );
        uint256 totalValue = IStrategy(optimalStrategy).getTotalValue();
        uint256 supply = lp.totalSupply();
        uint256 sum = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            sum += amounts[i];
        }
        uint256 lps = (sum * supply) / totalValue;
        lp.mint(lps);
        IStrategy(optimalStrategy).deposit(amounts);

        emit Deposited(amounts, lps);
        return lps;
    }

    function withdraw(uint256 lps, uint256[] calldata minAmounts) external {
        require(
            lp.balanceOf(_msgSender()) >= lps,
            "Zunami: not enough LP balance"
        );
        IStrategy(optimalStrategy).withdraw(
            _msgSender(),
            lps,
            lp.totalSupply(),
            minAmounts
        );
        lp.burn(lps);
        emit Withdrawn(minAmounts, lps);
    }
}
