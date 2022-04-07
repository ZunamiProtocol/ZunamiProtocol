//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './AnchorConstants.sol';
import './AnchorStratBase.sol';

contract AnchorStrat is AnchorStratBase {
    constructor()
        AnchorStratBase(
            Config({
                tokens: [
                    IERC20Metadata(AnchorConstants.DAI_ADDRESS),
                    IERC20Metadata(AnchorConstants.USDC_ADDRESS),
                    IERC20Metadata(AnchorConstants.USDT_ADDRESS)
                ],
                aTokens: [
                    IERC20Metadata(AnchorConstants.aDAI_ADDRESS),
                    IERC20Metadata(AnchorConstants.aUSDC_ADDRESS),
                    IERC20Metadata(AnchorConstants.aUSDT_ADDRESS)
                ],
                aTokenPools: [
                    IConversionPool(AnchorConstants.aDAI_POOL_ADDRESS),
                    IConversionPool(AnchorConstants.aUSDC_POOL_ADDRESS),
                    IConversionPool(AnchorConstants.aUSDT_POOL_ADDRESS)
                ]
            })
        )
    {}
}
