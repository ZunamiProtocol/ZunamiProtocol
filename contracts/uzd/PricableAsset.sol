// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import "./interfaces/IAssetPriceOracle.sol";

contract PricableAsset is Ownable {

    uint256 private _cachedBlock;
    uint256 private _cachedAssetPrice;

    IAssetPriceOracle public priceOracle;

    constructor(address priceOracle_) {
        changePriceOracle(priceOracle_);
    }

    function changePriceOracle(address priceOracle_) public onlyOwner {
        require(priceOracle_ != address(0), "Zero price oracle");
        priceOracle = IAssetPriceOracle(priceOracle_);
    }

    function assetPrice() public view returns(uint256) {
        return priceOracle.lpPrice();
    }

    function assetPriceCached() public returns(uint256) {
        if(block.number != _cachedBlock) {
            _cachedBlock = block.number;
            uint256 currentAssetPrice = assetPrice();
            if(_cachedAssetPrice < currentAssetPrice) {
                _cachedAssetPrice = assetPrice();
            }
        }
        return _cachedAssetPrice;
    }
}
