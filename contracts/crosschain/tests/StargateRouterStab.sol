//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/stargate/IStargateRouter.sol";
import "../interfaces/stargate/IStargateReceiver.sol";

contract StargateRouterStab {
    function swap(
        uint16 _dstChainId,
        uint256 _srcPoolId,
        uint256 _dstPoolId,
        address payable _refundAddress,
        uint256 _amountLD,
        uint256 _minAmountLD,
        IStargateRouter.lzTxObj memory _lzTxParams,
        bytes calldata _to,
        bytes calldata _payload
    ) external payable {}

    function sgReceive(
        address _receiver,
        uint16 _srcChainId,              // the remote chainId sending the tokens
        bytes memory _srcAddress,        // the remote Bridge address
        uint256 _nonce,
        address _token,                  // the token contract on the local chain
        uint256 amountLD,                // the qty of local _token contract tokens
        bytes memory payload
    ) external {
        IStargateReceiver(_receiver).sgReceive(_srcChainId, _srcAddress, _nonce, _token, amountLD, payload);
    }
}
