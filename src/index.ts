import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction
} from "@flashbots/ethers-provider-bundle";
import { providers, Wallet } from "ethers";
import { TransferERC20 } from "./engine/TransferERC20";
import { Base } from "./engine/Base";
import { checkSimulation, ETHER, gasPriceToGwei, printTransactions } from "./utils";
// import { CryptoKitties } from "./engine/CryptoKitties";

require('log-timestamp');

const MINER_REWARD_IN_WEI = ETHER.div(1000).mul(12); // 0.012 ETH
const BLOCKS_IN_FUTURE = 2;

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545"
const PRIVATE_KEY_ZERO_GAS = process.env.PRIVATE_KEY_ZERO_GAS || ""
const PRIVATE_KEY_DONOR = process.env.PRIVATE_KEY_DONOR || ""
const FLASHBOTS_SECRET = process.env.FLASHBOTS_SECRET || "";
const RECIPIENT = process.env.RECIPIENT || ""

if (PRIVATE_KEY_ZERO_GAS === "") {
  console.warn("Must provide PRIVATE_KEY_ZERO_GAS environment variable, corresponding to Ethereum EOA with assets to be transferred")
  process.exit(1)
}
if (PRIVATE_KEY_DONOR === "") {
  console.warn("Must provide PRIVATE_KEY_DONOR environment variable, corresponding to an Ethereum EOA with ETH to pay miner")
  process.exit(1)
}
if (FLASHBOTS_SECRET === "") {
  console.warn("Must provide FLASHBOTS_SECRET environment variable. Please see https://hackmd.io/@flashbots/rk-qzgzCD")
  process.exit(1)
}
if (RECIPIENT === "") {
  console.warn("Must provide RECIPIENT environment variable, an address which will receive assets")
  process.exit(1)
}

const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);

const walletZeroGas = new Wallet(PRIVATE_KEY_ZERO_GAS, provider);
const walletDonor = new Wallet(PRIVATE_KEY_DONOR, provider);
const walletAuth = new Wallet(FLASHBOTS_SECRET, provider)

console.log(`Zero Gas Account: ${walletZeroGas.address}`)
console.log(`Donor Account: ${walletDonor.address}`)
console.log(`Miner Reward: ${MINER_REWARD_IN_WEI.mul(1000).div(ETHER).toNumber() / 1000}`)

async function main() {
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, walletAuth);

  const tokenAddress = "0xFca59Cd816aB1eaD66534D82bc21E7515cE441CF";
  const engine: Base = new TransferERC20(provider, walletZeroGas.address, RECIPIENT, tokenAddress);

  // const kittyIds = [14925,97811];
  // const engine: Base = new CryptoKitties(provider, walletZeroGas.address, RECIPIENT, kittyIds);

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
