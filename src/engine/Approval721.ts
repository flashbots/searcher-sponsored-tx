import { BigNumber, Contract } from "ethers";
import { isAddress } from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { Base } from "./Base";

const ERC721_ABI = [{
  "constant": true,
  "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {
    "internalType": "address",
    "name": "operator",
    "type": "address"
  }],
  "name": "isApprovedForAll",
  "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
  "payable": false,
  "stateMutability": "view",
  "type": "function"
}, {
  "constant": false,
  "inputs": [{"internalType": "address", "name": "to", "type": "address"}, {
    "internalType": "bool",
    "name": "approved",
    "type": "bool"
  }],
  "name": "setApprovalForAll",
  "outputs": [],
  "payable": false,
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [{"internalType": "address", "name": "from", "type": "address"}, {
    "internalType": "address",
    "name": "to",
    "type": "address"
  }, {"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
  "name": "safeTransferFrom",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [{"internalType": "address", "name": "from", "type": "address"}, {
    "internalType": "address",
    "name": "to",
    "type": "address"
  }, {"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
  "name": "transferFrom",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}]


export class Approval721 extends Base {
  private _recipient: string;
  private _contractAddresses721: string[];

  constructor(recipient: string, contractAddresses721: string[]) {
    super()
    if (!isAddress(recipient)) throw new Error("Bad Address")
    this._recipient = recipient;
    this._contractAddresses721 = contractAddresses721;
  }

  async description(): Promise<string> {
    return `Giving ${this._recipient} approval for: ${this._contractAddresses721.join(", ")}`
  }

  getSponsoredTransactions(): Promise<Array<TransactionRequest>> {
    return Promise.all(this._contractAddresses721.map(async (contractAddress721) => {
      const erc721Contract = new Contract(contractAddress721, ERC721_ABI);
      return {
        ...(await erc721Contract.populateTransaction.setApprovalForAll(this._recipient, true)),
        gasPrice: BigNumber.from(0),
      }
    }))
  }
}
