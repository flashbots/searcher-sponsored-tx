require('dotenv').config();
require('log-timestamp');

import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction
} from "@flashbots/ethers-provider-bundle";
import { providers, Wallet } from "ethers";
import { TransferERC20 } from "./engine/TransferERC20";
import { Base as Engine } from "./engine/Base";
import { checkSimulation, ETHER, gasPriceToGwei, printTransactions } from "./utils";
import { TransferERC721 } from "./engine/TransferERC721";

const MINER_REWARD_IN_WEI = ETHER.div(1000).mul(12);
const BLOCKS_IN_FUTURE = 2;

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545"
const PRIVATE_KEY_ZERO_GAS = process.env.PRIVATE_KEY_ZERO_GAS || ""
const PRIVATE_KEY_DONOR = process.env.PRIVATE_KEY_DONOR || ""
const FLASHBOTS_RELAY_SIGNING_KEY = process.env.FLASHBOTS_RELAY_SIGNING_KEY || "";
const RECIPIENT = process.env.RECIPIENT || ""
const ENGINE = process.env.ENGINE || 'erc20';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const TOKEN_IDS = (process.env.TOKEN_IDS || '').split(',');
const DRY_RUN = !!process.env.DRY_RUN;
const FLASHBOTS_RELAY_URL = process.env.FLASHBOTS_RELAY_URL || undefined;

if (PRIVATE_KEY_ZERO_GAS === "") {
  console.warn("Must provide PRIVATE_KEY_ZERO_GAS environment variable, corresponding to Ethereum EOA with assets to be transferred")
  process.exit(1)
}
if (PRIVATE_KEY_DONOR === "") {
  console.warn("Must provide PRIVATE_KEY_DONOR environment variable, corresponding to an Ethereum EOA with ETH to pay miner")
  process.exit(1)
}
if (FLASHBOTS_RELAY_SIGNING_KEY === "") {
  console.warn("Must provide FLASHBOTS_RELAY_SIGNING_KEY environment variable. Please see https://github.com/flashbots/pm/blob/main/guides/flashbots-alpha.md")
  process.exit(1)
}
if (RECIPIENT === "") {
  console.warn("Must provide RECIPIENT environment variable, an address which will receive assets")
  process.exit(1)
}
if (CONTRACT_ADDRESS === '') {
  console.warn('Must provide CONTRACT_ADDRESS environment variable, for the token contract to interact with');
  process.exit(1);
}
if (ENGINE !== 'erc20' && ENGINE !== 'erc721') {
  console.warn('Available ENGINEs are erc20, erc721');
  process.exit(1);
}
if (ENGINE === 'erc721' && TOKEN_IDS === ['']) {
  console.warn('Must provide comma-separated list of TOKEN_IDS as environment variable if engine is erc721');
  process.exit(1);
}

const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);

const walletZeroGas = new Wallet(PRIVATE_KEY_ZERO_GAS, provider);
const walletDonor = new Wallet(PRIVATE_KEY_DONOR, provider);
const walletRelay = new Wallet(FLASHBOTS_RELAY_SIGNING_KEY, provider)

if (DRY_RUN) console.log(`Dry Run (no transactions will be sent to the chain)`);
console.log(`Token Contract Address: ${CONTRACT_ADDRESS}`)
console.log(`Zero Gas Account: ${walletZeroGas.address}`)
console.log(`Donor Account: ${walletDonor.address}`)
console.log(`Miner Reward: ${MINER_REWARD_IN_WEI.mul(1000).div(ETHER).toNumber() / 1000}`)

function getEngine(provider: FlashbotsBundleProvider): Engine {
  const sender = walletZeroGas.address;
  if (ENGINE === 'erc20') {
    return new TransferERC20(provider, sender, RECIPIENT, CONTRACT_ADDRESS);
  } else if (ENGINE === 'erc721') {
    return new TransferERC721(provider, sender, RECIPIENT, CONTRACT_ADDRESS, TOKEN_IDS);
  } else {
    throw new Error(`Unknown engine ${ENGINE}`);
  }
}

async function main() {
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, walletRelay, FLASHBOTS_RELAY_URL);
  const engine: Engine = getEngine(flashbotsProvider);

  const zeroGasTxs = await engine.getZeroGasPriceTx();
  const donorTx = await engine.getDonorTx(MINER_REWARD_IN_WEI);

  const bundleTransactions: Array<FlashbotsBundleTransaction> = [
    ...zeroGasTxs.map(transaction => {
      return {
        transaction,
        signer: walletZeroGas,
      }
    }),
    {
      transaction: donorTx,
      signer: walletDonor
    }
  ]
  const signedBundle = await flashbotsProvider.signBundle(bundleTransactions)
  await printTransactions(bundleTransactions, signedBundle);
  const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
  console.log(`Gas Price: ${gasPriceToGwei(gasPrice)} gwei`)
  console.log(await engine.description())
  if (DRY_RUN) return;

  provider.on('block', async (blockNumber) => {
    const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
    const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;
    console.log(`Current Block Number: ${blockNumber},   Target Block Number:${targetBlockNumber},   gasPrice: ${gasPriceToGwei(gasPrice)} gwei`)
    const bundleResponse = await flashbotsProvider.sendBundle(bundleTransactions, targetBlockNumber);
    const bundleResolution = await bundleResponse.wait()
    if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log(`Congrats, included in ${targetBlockNumber}`)
      process.exit(0)
    } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log(`Not included in ${targetBlockNumber}`)
    } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("Nonce too high, bailing")
      process.exit(1)
    }
  })
}

main()
