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

contract Zunamigateway is AccessControl, ILayerZeroReceiver, IStargateReceiver {
    using SafeERC20 for IERC20Metadata;

    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

    IZunami zunami;
    ICurvePool curveExchange;
    IStargateRouter stargateRouter;
    ILayerZeroEndpoint layerZeroEndpoint;

    uint8 public constant POOL_ASSETS = 3;

    int128 public constant DAI_TOKEN_ID = 0;
    int128 public constant USDC_TOKEN_ID = 1;
    uint128 public constant USDT_TOKEN_ID = 2;

    address[POOL_ASSETS] public tokens;
    uint256 public tokenPoolId;

    uint16 public gatewayChainId;
    address public gatewayAddress;
    uint256 public gatewayTokenPoolId;

    mapping(uint256 => uint256) internal _pendingDeposits;
    mapping(uint256 => bool) internal _pendingWithdrawals;

    event CreatedPendingDeposit(uint256 indexed id, uint256 tokenAmount);
    event CreatedPendingWithdrawal(
        uint256 indexed id,
        uint256 lpShares
    );
    event Deposited(uint256 indexed id, uint256 lpShares);
    event Withdrawn(
        uint256 indexed id,
        uint256 tokenAmount
    );

    event SetGatewayParams(
        uint256 _chainId,
        address _address,
        uint256 _tokenPoolId
    );

    constructor(
        address[POOL_ASSETS] memory _tokens,
        uint256 _tokenPoolId,
        address _zunami,
        address _curveExchange,
        address _stargateRouter,
        address _layerZeroEndpoint
    ) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
        tokens = _tokens;

        zunami = IZunami(_zunami);
        stargateRouter = IStargateRouter(_stargateRouter);
        layerZeroEndpoint = ILayerZeroEndpoint(_layerZeroEndpoint);

        curveExchange = ICurvePool(_curveExchange); // Constants.CRV_3POOL_ADDRESS
    }

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

    function pendingDeposits(uint256 depositId) external view returns (uint256) {
        return _pendingDeposits[depositId];
    }

    function pendingWithdrawals(uint256 withdrawalId) external view returns (bool) {
        return _pendingWithdrawals[withdrawalId];
    }

    function sgReceive(
        uint16 _srcChainId,              // the remote chainId sending the tokens
        bytes memory _srcAddress,        // the remote Bridge address
        uint256 _nonce,
        address _token,                  // the token contract on the local chain
        uint256 amountLD,                // the qty of local _token contract tokens
        bytes memory payload
    ) external {
        // 1/ receive stargate deposit in USDC or USDT
        require(_srcChainId == gatewayChainId, "ZunamiForwarder: wrong source chain id");

        (uint256 depositId) = abi.decode(payload, (uint256));
        require(_token == tokens[USDT_TOKEN_ID], "ZunamiForwarder: wrong token address");
        // 2/ create deposite in Zunami
        uint256[3] memory amounts;
        amounts[uint256(USDT_TOKEN_ID)] = amountLD;
        IERC20Metadata(_token).safeTransferFrom(address(this), address(zunami), amountLD);
        zunami.delegateDeposit(amounts);

        emit CreatedPendingDeposit(depositId, amountLD);
    }

    function completeDeposits(uint256 depositId, uint256 zlpTotalAmount)
    external
    onlyRole(OPERATOR_ROLE)
    {
        // 0/ wait until receive ZLP tokens
        // 1/ send zerolayer message to gateway with ZLP amount
        bytes memory payload = abi.encode(depositId, _pendingDeposits[depositId], zlpTotalAmount);

        // use adapterParams v1 to specify more gas for the destination
        uint16 version = 1;
        uint gasForDestinationLzReceive = 350000;
        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);

        // get the fees we need to pay to LayerZero for message delivery
        (uint messageFee, ) = layerZeroEndpoint.estimateFees(gatewayChainId, address(this), payload, false, adapterParams);
        require(address(this).balance >= messageFee, "address(this).balance < messageFee. fund this contract with more ether");

        layerZeroEndpoint.send{value: messageFee}( // {value: messageFee} will be paid out of this contract!
            gatewayChainId, // destination chainId
            abi.encodePacked(gatewayAddress), // destination address of PingPong contract
            payload, // abi.encode()'ed bytes
            payable(address(this)), // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
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
        // 1/ Receive request to withdrawal
        (uint256 withdrawalId, uint256 zlpAmount) = abi.decode(_payload, (uint256, uint256));

        // 2/ Create withdrawal request in Zunami
        uint256[POOL_ASSETS] memory tokenAmounts;
        IERC20Metadata(address(zunami)).safeTransferFrom(address(this), address(zunami), zlpAmount);
        zunami.delegateWithdrawal(zlpAmount, tokenAmounts);
        _pendingWithdrawals[withdrawalId] = true;

        emit CreatedPendingWithdrawal(withdrawalId, zlpAmount);
    }

    function completeWithdrawals(uint256 withdrawalId)
    external
    payable
    onlyRole(OPERATOR_ROLE)
    {
        // 0/ wait to receive stables from zunami
        // 1/ exchange DAI and USDC to USDT
        exchangeOtherTokenToUSDT(DAI_TOKEN_ID);

        exchangeOtherTokenToUSDT(USDC_TOKEN_ID);

        // 2/ send USDT by start gate to gateway
        uint256 usdtAmount = IERC20Metadata(tokens[USDT_TOKEN_ID]).balanceOf(address(this));

        // the msg.value is the "fee" that Stargate needs to pay for the cross chain message
        stargateRouter.swap{value:msg.value}(
            gatewayChainId,                             // LayerZero chainId
            tokenPoolId,                // source pool id
            gatewayTokenPoolId,         // dest pool id
            payable(msg.sender),                        // refund adddress. extra gas (if any) is returned to this address
            usdtAmount,                                 // quantity to swap
            usdtAmount,                                 // the min qty you would accept on the destination
            IStargateRouter.lzTxObj(0, 0, "0x"),         // 0 additional gasLimit increase, 0 airdrop, at 0x address
            abi.encodePacked(gatewayAddress),           // the address to send the tokens to on the destination
            abi.encode(withdrawalId)     // bytes param, if you wish to send additional payload you can abi.encode() them here
        );

        emit Withdrawn(withdrawalId, usdtAmount);
    }

    function exchangeOtherTokenToUSDT(int128 tokenId) internal {
        uint256 tokenBalance = IERC20Metadata(tokens[uint128(tokenId)]).balanceOf(address(this));
        if(tokenBalance > 0) {
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
}
