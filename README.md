searcher-sponsored-tx
=======================
This repository contains a simple Flashbots "searcher" for submitting a transaction from an `executor` account, but paying for the transaction from a `sponsor` account. This is accomplished by submitting a Flashbots transaction bundle, with the first "sponsor" transaction paying the "executor" wallet in ETH, followed by a series of `executor` transactions that spend this newly received ETH on gas fees.

We hope you will use this repository as an example of how to integrate Flashbots into your own Flashbot searcher (bot). For more information, see the [Flashbots Searcher Quick Start](https://docs.flashbots.net/flashbots-auction/searchers/quick-start/)

Use case
========
The use case for this multi-transaction setup is to make calls from an account that has a compromised private key. Since transferring in any ETH to this compromised wallet will immediately be swept by bots that monitor that account, transferring in funds will also give any attacker the ability to withdraw tokens that are held by that account.

Using this searcher, you can create a bundle of transaction that execute against the compromised account, spending ETH that was received in the same block.

With the activation of EIP-1559, the old method of using `gasPrice = 0` is no longer functional. Transactions must pay at least `baseFee`.


Environment Variables
=====================
- ETHEREUM_RPC_URL - Ethereum RPC endpoint. Can not be the same as FLASHBOTS_RPC_URL
- PRIVATE_KEY_EXECUTOR - Private key for the compromised Ethereum EOA that owns assets that needs to be transferred
- PRIVATE_KEY_SPONSOR - Private key for an account that has ETH that will be used to fund the miner for the "ZERO_GAS" transactions 
- RECIPIENT - Ethereum EOA to receive assets from ZERO_GAS account
- FLASHBOTS_RELAY_SIGNING_KEY - Optional param, private key used to sign messages to Flashbots to establish reputation of profitability

Setting Miner Reward
====================
Inside `src/index.ts` is :
```
const PRIORITY_GAS_PRICE = GWEI.mul(31)
```

This is the priority fee, on top of baseFee, sent to the miner for *all* transactions in the bundle, including the sponsor-funding transaction. All transactions use the same gasPrice, with no coinbase transfers in any transaction. In the case of a block re-organization, hopefully all transactions will appear in the next block as well, preventing sweeper bots from gaining access to the incoming ETH before it is spent on gas fees.

Selecting a different "engine"
==============================
This system can operate against different protocols by swapping a new "engine" class that adheres to "Base" functionality in the `main()` function. Available engines:
- `TransferERC20`
- `CryptoKitties`
- `Approval721`
  

An engine accepts relevant parameters during construction and provides functions to retrieve transaction descriptions to be passed in to Flashbots. Selecting and configuring a different engine requires directly modifying the source, uncommenting the engine and setting the necessary variables.


Usage
======================
```
$ npm install
$ PRIVATE_KEY_EXECUTOR=__COMPROMISED_PRIVATE_KEY__ \
    PRIVATE_KEY_SPONSOR=__FUNDED_PRIVATE_KEY__ \
    RECIPIENT=__ADDRESS_THAT_RECEIVES_ASSETS__ \
    FLASHBOTS_SECRET=__YOUR_PERSONAL_SECRET__ \
      npm run start
```
