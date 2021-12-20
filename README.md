# Zunami Protocol

## The First Decentralized Revenue Aggregator

There is no doubt that high commissions are a fundamental problem on the Ethereum network. The further progress and future of DeFi are impossible without overcoming these vital inefficiencies. When a transaction consists of deposits in several smart contracts in a row, the commission for its implementation goes beyond all reasonable boundaries. Nowadays, the gates to the yield-farming realm are closed for the people who only have small deposits, so they are ultimately being cut off from this profitable global finance game. Zunami Protocol team has come up with a solution though.

We have created a multi-layer smart contract or Transaction Streamlining Mechanism (TSM) to counter this issue. How does it work? Users deposit funds into the Zunami.sol smart contract using the delegateDeposit() function. Then, at least once a day, the mechanism of automatic sending to the pools will be launched the completeDeposit() function and allocate user funds to strategies.

## 1. Finding the most profitable pool

The return rates in stablecoin pools are highly volatile. Today, one of the pools shows the best APY / APR on the market, but it is already an outsider a week later. Finding the best pools and transferring funds from pool to pool is expensive and requires constant market research, which is not suitable for generating passive income.

The Zunami Protocol uses a couple formulas to calculate APR / APY and select the most profitable pool when depositing funds. When a user wants to withdraw the funds, the most unprofitable pool is calculated and funds are withdrawn from it. If funds are stagnant in a non-profitable strategy, the mechanism of manual rebalancing of funds is used, which is specified in the moveFunds() and moveFundsBatch() functions. The funds from the least profitable strategy are transferred to the best pool. There is also a mechanism for withdrawing funds in case of force majeure emergencyWithdraw().

## 2. Strategies

The DeFi ecosystem is becoming more and more complex. One of the best stablecoin farming solutions nowadays is Curve Protocol. But to get the maximum yield now it is not enough to make a deposit only to Curve - yield boosters (Yearn, Convex) have entered the market. The user needs to make a deposit first in Curve, and then take LP tokens to Yearn or Convex.

The Zunami protocol has created a number of strategies and automated this process in one transaction, making life easier for users. As rewards, Users receive rewards in the form of tokens. For users with small deposits, the sale of rewards is not profitable at all due to high commissions in the ETH network. Zunami sells rewards for you and all you have to do is enjoy the full power of compound interest.

## 3. Pools

Zunami works with the following strategies at Convex:

MIM, USDP, MUSD, OUSD, FRAX, Iron Bank, SUSD, BUSD, BUSD V2, RSV, USDK, ALUSD, DUSD, USDN, TUSD

## Our contacts

#### 1. Twitter - https://twitter.com/zunamiprotocol?s=21

#### 2. Medium - https://zunamiprotocol.medium.com/

#### 3. Telegram - https://t.me/ZunamiCommunityChat

#### 4. Discord - https://discord.gg/BnC6kTWkUe

#### 5. Email - hello@zunami.io
