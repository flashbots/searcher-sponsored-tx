import { BigNumber, Contract } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { CHECK_AND_SEND_ABI } from "../abi";

export const ETHER = BigNumber.from(10).pow(18);
export const GWEI = BigNumber.from(10).pow(9);

export const CHECK_AND_SEND_CONTRACT_ADDRESS = '0xC4595E3966e0Ce6E3c46854647611940A09448d3'

export abstract class Base {
  protected static checkAndSendContract = new Contract(CHECK_AND_SEND_CONTRACT_ADDRESS, CHECK_AND_SEND_ABI);
  abstract getZeroGasPriceTx(): Promise<Array<TransactionRequest>>;

  abstract getDonorTx(minerReward: BigNumber): Promise<TransactionRequest>;

  abstract description(): Promise<string>;
}
