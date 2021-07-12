//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


library AddressAndTickers {
    bytes32 constant internal USDC_TICKER = 'usdc';
    bytes32 constant internal CURVE_TICKER = 'a3CRV';
    bytes32 constant internal YEARN_TICKER = 'saCRV';

    address constant internal USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant internal CURVE_TOKEN_ADDRESS = 0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900;
    address constant internal YEARN_TOKEN_ADDRESS = 0x02d341CcB60fAaf662bC0554d13778015d1b285C;

    address constant internal CURVE_AAVE_ADDRESS = 0xDeBF20617708857ebe4F679508E7b7863a8A8EeE;
    address constant internal YEARN_VAULT_ADDRESS = 0x03403154afc09Ce8e44C3B185C82C6aD5f86b9ab;
}
