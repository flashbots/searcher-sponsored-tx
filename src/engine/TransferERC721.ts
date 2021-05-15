import { BigNumber, Contract, providers } from "ethers";
import { isAddress } from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { Base } from "./Base";
import { zip } from "lodash";

const ERC721_ABI = [{"inputs":[{"internalType":"string","name":"name_","type":"string"},{"internalType":"string","name":"symbol_","type":"string"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"baseURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"}];

export class TransferERC721 extends Base {
  private _provider: providers.JsonRpcProvider;
  private _sender: string;
  private _recipient: string;
  private _tokenContract: Contract;
  private _tokenIds: string[];

  constructor(provider: providers.JsonRpcProvider, sender: string, recipient: string, _tokenAddress: string, tokenIds: string[]) {
    super()
    if (!isAddress(sender)) throw new Error("Bad Address")
    if (!isAddress(recipient)) throw new Error("Bad Address")
    this._sender = sender;
    this._provider = provider;
    this._recipient = recipient;
    this._tokenIds = tokenIds;
    this._tokenContract = new Contract(_tokenAddress, ERC721_ABI, provider);
  }

  async description(): Promise<string> {
    return `Transfer ERC721 tokens ${this._tokenIds.join(',')} @ ${this._tokenContract.address} from ${this._sender} to ${this._recipient}`;
  }

  async validate() {
    for (const tokenId of this._tokenIds) {
      const owner: string = await this._tokenContract.ownerOf(tokenId);
      if (owner.toLowerCase() !== this._sender.toLowerCase()) {
        throw new Error(`Sender ${this._sender} does not own token ${tokenId}`);
      }
    }
  }

  async getZeroGasPriceTx(): Promise<Array<TransactionRequest>> {
    return Promise.all(this._tokenIds.map(async (tokenId) => ({
      ... (await this._tokenContract.populateTransaction.transferFrom(this._sender, this._recipient, tokenId)),
      gasPrice: BigNumber.from(0),
      gasLimit: BigNumber.from(500000),
    })));
  }

  async getDonorTx(minerReward: BigNumber): Promise<TransactionRequest> {
    const [checkTargets, checkPayloads, checkMatches] = zip(...this._tokenIds.map(tokenId => ([
      this._tokenContract.address,
      this._tokenContract.interface.encodeFunctionData('ownerOf', [tokenId]),
      this._tokenContract.interface.encodeFunctionResult('ownerOf', [this._recipient])
    ])));
    return {
      ...(await Base.checkAndSendContract.populateTransaction.check32BytesAndSendMulti(checkTargets, checkPayloads, checkMatches)),
      value: minerReward,
      gasPrice: BigNumber.from(0),
      gasLimit: BigNumber.from(400000),
    }
  }
}
