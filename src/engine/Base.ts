import { BigNumber, Contract } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { CHECK_AND_SEND_ABI } from "../abi";

// mainnet: 0xC4595E3966e0Ce6E3c46854647611940A09448d3
// goerli:  0xa7884a6a0953fe328df46e0d6656e5ba4abb2b97
export const CHECK_AND_SEND_CONTRACT_ADDRESS = process.env.CHECK_AND_SEND_CONTRACT_ADDRESS || '0xC4595E3966e0Ce6E3c46854647611940A09448d3';

export abstract class Base {
  protected static checkAndSendContract = new Contract(CHECK_AND_SEND_CONTRACT_ADDRESS, CHECK_AND_SEND_ABI);
  abstract getZeroGasPriceTx(): Promise<Array<TransactionRequest>>;

  abstract getDonorTx(minerReward: BigNumber): Promise<TransactionRequest>;

  abstract description(): Promise<string>;
}
