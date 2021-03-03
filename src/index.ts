import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction
} from "@flashbots/ethers-provider-bundle";
import { BigNumber, providers, Wallet } from "ethers";
import { TransferERC20 } from "./engine/TransferERC20";
import { Base, ETHER, GWEI } from "./engine/Base";

require('log-timestamp');

const MINER_REWARD = ETHER.div(400);
const BLOCKS_IN_FUTURE = 2;

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545"
const PRIVATE_KEY_ZERO_GAS = process.env.PRIVATE_KEY_ZERO_GAS || ""
const PRIVATE_KEY_DONOR = process.env.PRIVATE_KEY_DONOR || ""
const FLASHBOTS_KEY_ID = process.env.FLASHBOTS_KEY_ID || "";
const FLASHBOTS_SECRET = process.env.FLASHBOTS_SECRET || "";
const GAS_PRICE_FLOOR_IN_GWEI = GWEI.mul(parseInt(process.env.GAS_PRICE_FLOOR_IN_GWEI || "30"))
const RECIPIENT = process.env.RECIPIENT || process.exit(1)

if (PRIVATE_KEY_ZERO_GAS === "") {
  console.warn("Must provide PRIVATE_KEY_ZERO_GAS environment variable")
  process.exit(1)
}
if (PRIVATE_KEY_DONOR === "") {
  console.warn("Must provide PRIVATE_KEY_DONOR environment variable")
  process.exit(1)
}
if (FLASHBOTS_KEY_ID === "" || FLASHBOTS_SECRET === "") {
  console.warn("Must provide FLASHBOTS_KEY_ID and FLASHBOTS_SECRET environment variable. Please see https://hackmd.io/@flashbots/rk-qzgzCD")
  process.exit(1)
}

const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);

const walletZeroGas = new Wallet(PRIVATE_KEY_ZERO_GAS, provider);
const walletDonor = new Wallet(PRIVATE_KEY_DONOR, provider);

console.log("Zero Gas Account: " + walletZeroGas.address)
console.log("Donor Account: " + walletDonor.address)

async function checkSimulation(flashbotsProvider: FlashbotsBundleProvider, signedBundle: Array<string>): Promise<BigNumber> {
  const simulationResponse = await flashbotsProvider.simulate(signedBundle, "latest");

  for (let i = 0; i < simulationResponse.results.length; i++) {
    const txSimulation = simulationResponse.results[i]
    if ("error" in txSimulation) {
      throw new Error(`TX #${i} : ${txSimulation.error} ${txSimulation.revert}`)
    }
  }

  const gasUsed = simulationResponse.results.reduce((acc: number, txSimulation) =>
    acc + txSimulation.gasUsed, 0)

  const gasPrice = simulationResponse.coinbaseDiff.div(gasUsed)
  if (gasPrice.lt(GAS_PRICE_FLOOR_IN_GWEI)) {
    throw new Error(`Gas price too low: ${gasPrice.toString()}`)
  }

  return gasPrice
}

async function main() {
  const flashbotsProvider = await FlashbotsBundleProvider.create(provider, FLASHBOTS_KEY_ID, FLASHBOTS_SECRET);

  const tokenAddress = "0xFca59Cd816aB1eaD66534D82bc21E7515cE441CF";
  const engine: Base = new TransferERC20(provider, walletZeroGas.address, RECIPIENT, tokenAddress);

  const zeroGasTxs = await engine.getZeroGasPriceTx();
  const donorTx = await engine.getDonorTx(MINER_REWARD);

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
  console.log("--------------------------------")
  console.log(
    (await Promise.all(
      bundleTransactions.map(async (bundleTx, index) =>
        `TX #${index}: ${await bundleTx.signer.getAddress()} => ${bundleTx.transaction.to} : ${bundleTx.transaction.data}`)))
      .join("\n"))
  const signedBundle = await flashbotsProvider.signBundle(bundleTransactions)

  console.log("--------------------------------")
  console.log(
    (await Promise.all(
      signedBundle.map(async (signedTx, index) =>
        `TX #${index}: ${signedTx}`)))
      .join("\n"))
  console.log(`Miner reward: ${MINER_REWARD}`)

  console.log("--------------------------------")
  await checkSimulation(flashbotsProvider, signedBundle);
  console.log(await engine.description())

  provider.on('block', async (blockNumber) => {
    const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
    const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;
    console.log("Current Block Number: " + blockNumber + ",   Target Block Number:" + targetBlockNumber + ",   gasPrice:", gasPrice.toString())
    const bundleResponse = await flashbotsProvider.sendBundle(bundleTransactions, targetBlockNumber);
    const bundleResolution = await bundleResponse.wait()
    if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log("Congrats, included in " + targetBlockNumber)
      process.exit(0)
    } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
      console.log("Not included in " + targetBlockNumber)
    } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("Nonce too high, bailing")
      process.exit(1)
    }
  })
}

main()
