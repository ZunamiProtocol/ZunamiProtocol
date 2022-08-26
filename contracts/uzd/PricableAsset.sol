// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAssetPriceOracle.sol";

contract PricableAsset {
    uint256 private _cachedBlock;
    uint256 private _cachedAssetPrice;

    IAssetPriceOracle public immutable priceOracle;

    constructor(IAssetPriceOracle priceOracle_) {
        priceOracle = priceOracle_;
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
