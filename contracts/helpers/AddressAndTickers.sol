//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AddressAndTickers {
    bytes32 internal constant DAI_TICKER = 'dai';
    bytes32 internal constant USDC_TICKER = 'usdc';
    bytes32 internal constant USDT_TICKER = 'usdt';
    bytes32 internal constant CURVE_TICKER = 'a3CRV';
    bytes32 internal constant YEARN_TICKER = 'saCRV';

    address internal constant DAI_ADDRESS = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address internal constant USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDT_ADDRESS = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    address internal constant CURVE_TOKEN_ADDRESS = 0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900;
    address internal constant YEARN_TOKEN_ADDRESS = 0x02d341CcB60fAaf662bC0554d13778015d1b285C;

    address internal constant CURVE_AAVE_ADDRESS = 0xDeBF20617708857ebe4F679508E7b7863a8A8EeE;
    address internal constant YEARN_VAULT_ADDRESS = 0x03403154afc09Ce8e44C3B185C82C6aD5f86b9ab;
}
