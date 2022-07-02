//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import "./interfaces/layerzero/ILayerZeroReceiver.sol";
import "./interfaces/stargate/IStargateReceiver.sol";
import "./interfaces/stargate/IStargateRouter.sol";
import "./interfaces/layerzero/ILayerZeroEndpoint.sol";
import "../interfaces/IZunami.sol";
import "../interfaces/ICurvePool.sol";

contract ZunamiForwarder is AccessControl, ILayerZeroReceiver, IStargateReceiver {
    using SafeERC20 for IERC20Metadata;

    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

    IZunami public zunami;
    ICurvePool public curveExchange;
    IStargateRouter public stargateRouter;
    ILayerZeroEndpoint public layerZeroEndpoint;

    uint8 public constant POOL_ASSETS = 3;

    int128 public constant DAI_TOKEN_ID = 0;
    int128 public constant USDC_TOKEN_ID = 1;
    uint128 public constant USDT_TOKEN_ID = 2;

    uint256 public constant SG_FEE_REDUCER = 999;
    uint256 public constant SG_FEE_DIVIDER = 1000;

    IERC20Metadata[POOL_ASSETS] public tokens;
    uint256 public tokenPoolId;

    uint16 public gatewayChainId;
    address public gatewayAddress;
    uint256 public gatewayTokenPoolId;

    event CreatedPendingDeposit(uint256 indexed id, uint256 tokenId, uint256 tokenAmount);
    event CreatedPendingWithdrawal(
        uint256 indexed id,
        uint256 lpShares
    );
    event Deposited(uint256 indexed id, uint256 lpShares);
    event Withdrawn(
        uint256 indexed id,
        uint256 tokenId,
        uint256 tokenAmount
    );

    event SetGatewayParams(
        uint256 chainId,
        address gateway,
        uint256 tokenPoolId
    );

    constructor(
        IERC20Metadata[POOL_ASSETS] memory _tokens,
        uint256 _tokenPoolId,
        address _zunami,
        address _curveExchange,
        address _stargateRouter,
        address _layerZeroEndpoint
    ) public {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(OPERATOR_ROLE, _msgSender());
        tokens = _tokens;
        tokenPoolId = _tokenPoolId;

        zunami = IZunami(_zunami);
        stargateRouter = IStargateRouter(_stargateRouter);
        layerZeroEndpoint = ILayerZeroEndpoint(_layerZeroEndpoint);

        curveExchange = ICurvePool(_curveExchange);
    }

    receive() external payable {}

    function setGatewayParams(
        uint16 _chainId,
        address _address,
        uint256 _tokenPoolId
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        gatewayChainId = _chainId;
        gatewayAddress = _address;
        gatewayTokenPoolId = _tokenPoolId;

        emit SetGatewayParams(_chainId, _address, _tokenPoolId);
    }

    function sgReceive(
        uint16 _srcChainId,              // the remote chainId sending the tokens
        bytes memory _srcAddress,        // the remote sender address
        uint256 _nonce,
        address _token,                  // the token contract on the local chain
        uint256 amountLD,                // the qty of local _token contract tokens
        bytes memory payload
    ) external {
        require(
            _msgSender() == address(stargateRouter),
            "Forwarder: only stargate router can call sgReceive!"
        );

        // 1/ receive stargate deposit in USDT
        require(_srcChainId == gatewayChainId, "Forwarder: wrong source chain id");

        (uint256 depositId) = abi.decode(payload, (uint256));
        require(_token == address(tokens[USDT_TOKEN_ID]), "Forwarder: wrong token address");
        // 2/ delegate deposit to Zunami
        uint256[3] memory amounts;
        amounts[uint256(USDT_TOKEN_ID)] = amountLD;
        IERC20Metadata(_token).safeApprove(address(zunami), amountLD);
        zunami.delegateDeposit(amounts);

        emit CreatedPendingDeposit(depositId, USDT_TOKEN_ID, amountLD);
    }

    function completeCrosschainDeposit(uint256 depositId, uint256 zlpTotalAmount)
    external
    payable
    onlyRole(OPERATOR_ROLE)
    {
        // 0/ wait until receive ZLP tokens back
        require(IERC20Metadata(address(zunami)).balanceOf(address(this)) >= zlpTotalAmount, "Forwarder: not enough zlp");
        // 1/ send layer zero message to Gateway with ZLP amount
        bytes memory payload = abi.encode(depositId, zlpTotalAmount);

        // use adapterParams v1 to specify more gas for the destination
        bytes memory adapterParams = abi.encodePacked(uint16(1), uint256(50000));

        layerZeroEndpoint.send{value: msg.value}(
            gatewayChainId, // destination chainId
            abi.encodePacked(gatewayAddress), // destination address
            payload, // abi.encode()'ed bytes
            payable(_msgSender()),
            address(0x0), // future param, unused for this example
            adapterParams // v1 adapterParams, specify custom destination gas qty
        );

        emit Deposited(depositId, zlpTotalAmount);
    }

    // @notice LayerZero endpoint will invoke this function to deliver the message on the destination
    // @param _srcChainId - the source endpoint identifier
    // @param _srcAddress - the source sending contract address from the source chain
    // @param _nonce - the ordered message nonce
    // @param _payload - the signed payload is the UA bytes has encoded to be sent
    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) external {
        require(
            _msgSender() == address(layerZeroEndpoint),
            "Forwarder: only zero layer endpoint can call lzReceive!"
        );

        // 1/ Receive request to withdrawal
        (uint256 withdrawalId, uint256 zlpAmount) = abi.decode(_payload, (uint256, uint256));

        // 2/ Delegate withdrawal request to Zunami
        uint256[POOL_ASSETS] memory tokenAmounts;
        IERC20Metadata(address(zunami)).safeApprove(address(zunami), zlpAmount);
        zunami.delegateWithdrawal(zlpAmount, tokenAmounts);

        emit CreatedPendingWithdrawal(withdrawalId, zlpAmount);
    }

    function completeCrosschainWithdrawal(uint256 withdrawalId)
    external
    payable
    onlyRole(OPERATOR_ROLE)
    {
        // 0/ wait to receive stables from Zunami

        // 1/ exchange DAI and USDC to USDT
        exchangeOtherTokenToUSDT(DAI_TOKEN_ID);

        exchangeOtherTokenToUSDT(USDC_TOKEN_ID);

        // 2/ send USDT by startgate to gateway
        uint256 tokenTotalAmount = tokens[USDT_TOKEN_ID].balanceOf(address(this));

        tokens[USDT_TOKEN_ID].safeIncreaseAllowance(address(stargateRouter), tokenTotalAmount);

        stargateRouter.swap{value:msg.value}(
            gatewayChainId,                                     // LayerZero chainId
            tokenPoolId,                                        // source pool id
            gatewayTokenPoolId,                                 // dest pool id
            payable(_msgSender()),                              // refund address. extra gas (if any) is returned to this address
            tokenTotalAmount,                                   // quantity to swap
            tokenTotalAmount * SG_FEE_REDUCER / SG_FEE_DIVIDER, // the min qty you would accept on the destination
            IStargateRouter.lzTxObj(50000, 0, "0x"),            // 0 additional gasLimit increase, 0 airdrop, at 0x address
            abi.encodePacked(gatewayAddress),                   // the address to send the tokens to on the destination
            abi.encode(withdrawalId)                            // bytes param, if you wish to send additional payload you can abi.encode() them here
        );

        emit Withdrawn(withdrawalId, USDT_TOKEN_ID, tokenTotalAmount);
    }

    function exchangeOtherTokenToUSDT(int128 tokenId) internal {
        uint256 tokenBalance = tokens[uint128(tokenId)].balanceOf(address(this));
        if(tokenBalance > 0) {
            tokens[uint128(tokenId)].safeIncreaseAllowance(address(curveExchange), tokenBalance);
            curveExchange.exchange(tokenId, int128(USDT_TOKEN_ID), tokenBalance, 0);
        }
    }

    /**
     * @dev governance can withdraw all stuck funds in emergency case
     * @param _token - IERC20Metadata token that should be fully withdraw from Zunami
     */
    function withdrawStuckToken(IERC20Metadata _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 tokenBalance = _token.balanceOf(address(this));
        if (tokenBalance > 0) {
            _token.safeTransfer(_msgSender(), tokenBalance);
        }
    }

    function withdrawStuckNative() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(_msgSender()).transfer(balance);
        }
    }
}
