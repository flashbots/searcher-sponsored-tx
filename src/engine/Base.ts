import { TransactionRequest } from "@ethersproject/abstract-provider";

export abstract class Base {
  abstract getSponsoredTransactions(): Promise<Array<TransactionRequest>>;
  abstract description(): Promise<string>;
}
