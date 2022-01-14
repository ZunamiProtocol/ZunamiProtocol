# Zunami Protocol

## The First Decentralized Revenue Aggregator

There is no doubt that high commissions are a fundamental problem on the Ethereum network. The further progress and
future of DeFi are impossible without overcoming these vital inefficiencies. When a transaction consists of deposits in
several smart contracts in a row, the commission for its implementation goes beyond all reasonable boundaries. Nowadays,
the gates to the yield-farming realm are closed for the people who only have small deposits, so they are ultimately
being cut off from this profitable global finance game. Zunami Protocol team has come up with a solution though.

We have created a multi-layer smart contract or Transaction Streamlining Mechanism (TSM) to counter this issue. How does
it work? Users deposit funds into the Zunami.sol smart contract using the delegateDeposit() function. Then, at least
once a day, the mechanism for automatic submission to pools will run the completeDeposit() function and distribute
users' funds according to designated strategies.

## 1. Finding the most profitable pool

The return rates in stablecoin pools are very volatile. One of the pools showing the best APY / APR on the market might
become an outsider next week. Finding the best pools and transferring funds from pool to pool is too expensive and
requires constant market research, which is not suitable for generating stable passive income.

The Zunami protocol uses a couple of formulas to calculate APR / APY and select the most profitable pool while
depositing funds. When a user wants to withdraw funds, the most unprofitable pool is calculated and funds are withdrawn
from it. If funds stagnate in an unprofitable strategy, a mechanism for the manual rebalancing of funds starts, which is
specified in the moveFunds () and moveFundsBatch () functions. Funds from the least profitable strategy are transferred
to the best-performing pool. There is also a mechanism for withdrawing funds in case of force majeure -
emergencyWithdraw().

## 2. Strategies

The DeFi ecosystem is becoming more complex and intricate. One of the best solutions for farming stablecoins available
today is Curve Protocol. However, to reach maximum profitability, it is not enough to simply deposit only on Curve -
profitability boosters (Yearn, Convex) have entered the market and raised the bar for one's income. The user must
deposit into Curve first and then acquire LP tokens at Yearn or Convex.

The Zunami team created a number of strategies and automated this process into a single transaction, making the DeFi
experience more straightforward for users. As a reward, users will receive rewards in the platform's tokens. For users
with small deposits, the sale of rewards is generally unprofitable due to the high commissions on the ETH network.
Zunami Protocol sells rewards and all you have to do is enjoy the compound interest to the fullest.

## 3. Pools

Zunami Protocol works with the following pools in Convex:

MIM, USDP, MUSD, OUSD, FRAX, Iron Bank, SUSD, BUSD, BUSD V2, RSV, USDK, ALUSD, DUSD, USDN, TUSD

## Our contacts

#### 1. Twitter - https://twitter.com/zunamiprotocol?s=21

#### 2. Medium - https://zunamiprotocol.medium.com/

#### 3. Telegram - https://t.me/ZunamiCommunityChat

#### 4. Discord - https://discord.gg/BnC6kTWkUe

#### 5. Email - hello@zunami.io
