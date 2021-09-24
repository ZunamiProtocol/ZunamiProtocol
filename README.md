# Zunami Protocol
Zunami Protocol is the first automated asset manager that works only with stablecoins. Our main priority is to create an absolutely safe and a more profitable alternative to bank deposits.

## How it works
We allocate users’ money over five different DeFi projects across several blockchains and we automatically sell rewards and re-invest profits so that users can enjoy all the power of compound interest.

## Technical details
Our project consists of three main entities:

### 1. Zunami Vault
Zunami is the main mechanism for dealing with stable coins. We accept coins such as DAI, USDC and USDT from users. Using this functionality, the user can deposit or withdraw his money.

1. `deposit(amounts[])`, deposits DAI-USDC-USDT in specified amounts to the strategy, returns minted lp token shares 
2. `withdraw(lpShares, minAmounts[])`, burns lp shares in exchange for stablecoins from strategy, returns it with profits, at min amounts specified.
3. `claimProfit`, claim profit share for Zunami protocol team
4. `updateStrategy`, updates strategy from Zunami contract owner according to the most profitable strategy calculated on The Graph network each day.

### 2. Strategies
Strategies are a mechanism for interacting with the protocols of our partners such as Curve, Yearn and others. The strategies also have functionality for insuring the deposits of our users. Current strategy is to deposit into Curve Aave stable pool (USDC-DAI-USDT) and stake LPs in Convex to receive both CRV and CVX, then sell them for stable coins profits. 

#### CurveAaveConvex:
Controlled by Zunami contract

1. `deposit(amounts[])`, deposits DAI-USDC-USDT in specified amounts to the strategy
2. `withdraw(depositor, lpShares, minAmounts[])`, withdraws user curve lp token share in exchange for stablecoins from strategy with rewards, sells CRV and CVX, sends it to the user.
3. `withdrawAll()`, full withdrawal for strategy switch.

## Our contacts
#### 1. Twitter - https://twitter.com/zunamiprotocol?s=21
#### 2. Medium  - https://medium.com/@ZunamiProtocol
#### 3. Email   - hello@zunami.io
