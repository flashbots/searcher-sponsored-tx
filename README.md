searcher-sponsored-tx
=======================
This repository contains a simple Flashbots "searcher" for submitting a transaction from account X, but paying for the transaction from account Y. This is accomplished by submitting a Flashbots transaction bundle, with the first transaction(s) executing from account X, and the last, single transaction calling a contract which verifies the early transactions ran successfully, then pays the miner.

We hope you will use this repository as an example of how to integrate Flashbots into your own Flashbot searcher (bot). For more information, see the [Flashbots Searcher FAQ](https://hackmd.io/@flashbots/rk-qzgzCD)

Use case
========
The use case for this multi-transaction setup is to make calls from an account that has a compromised private key. Since transferring in any ETH to this compromised wallet will immediately be swept by bots that monitor that account. Transferring in funds will also give any attacker the ability to withdraw tokens that are held by that account.

Using this searcher, you can create a bundle of 0-gas-price transaction that execute against the compromised account, then reward the miner in a later transaction from a non-compromised account. The last transaction should execute a contract function to ensure the earlier transaction ran successfully (both to avoid mistakes AND to ensure the miner can't simply take the reward transaction without processing the 0-gas-price transactions).

Environment Variables
=====================
- ETHEREUM_RPC_URL - Ethereum RPC endpoint. Can not be the same as FLASHBOTS_RPC_URL
- PRIVATE_KEY_ZERO_GAS - Private key for the compromised Ethereum EOA that owns assets that needs to be transferred
- PRIVATE_KEY_DONOR - Private key for an account that has ETH that will be used to fund the miner for the "ZERO_GAS" transactions 
- FLASHBOTS_KEY_ID / FLASHBOTS_SECRET - Flashbots submissions requires an API key. [Apply for an API key here](https://docs.google.com/forms/d/e/1FAIpQLSd4AKrS-vcfW1X-dQvkFY73HysoKfkhcd-31Tj8frDAU6D6aQ/viewform) 
- RECIPIENT - Ethereum EOA to receive assets from ZERO_GAS account
- GAS_PRICE_FLOOR_IN_GWEI _[Optional]_ - Sets a gas price that will cause the process to exit if the bundle simulation ever reports a gas price less than.

Usage
======================
