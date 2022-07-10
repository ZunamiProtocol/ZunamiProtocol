//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/layerzero/ILayerZeroReceiver.sol";

contract LayerZeroEndpointStab {
    function send(uint16 _dstChainId, bytes calldata _destination, bytes calldata _payload, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable {}

    function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParam) external view returns (uint nativeFee, uint zroFee) {
        return (0,0);
    }

    function lzReceive(address receiver, uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) external {
        ILayerZeroReceiver(receiver).lzReceive(_srcChainId, _srcAddress, _nonce, _payload);
    }
}
