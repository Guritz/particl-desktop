import { Injectable } from '@angular/core';
import { Log } from 'ng2-logger'

import { Transaction } from './transaction.model';

import { RpcService } from '../../../core/core.module';

@Injectable()
export class TransactionService {

  log: any = Log.create('transaction.service');

  /* Stores transactions objects. */
  txs: Transaction[] = [];

  /* Pagination stuff */
  txCount: number = 0;
  currentPage: number = 0;
  totalPageCount: number = 0;

  /* Blocks */
  block: number = 0;
  /* states */
  loading: boolean = false;
  testnet: boolean = false;


  /* How many transactions do we display per page and keep in memory at all times.
     When loading more transactions they are fetched JIT and added to txs. */
  MAX_TXS_PER_PAGE: number = 10;
  PAGE_SIZE_OPTIONS: Array<number> = [10, 25, 50, 100, 250];

  constructor(private rpc: RpcService) {
    this.log.d(`Constructor(): called`);
    this.postConstructor(this.MAX_TXS_PER_PAGE);

    this.rpc.state.observe('txcount')
      .subscribe(
        txcount => {
          this.txCount = txcount;
          this.loading = true;
          this.log.d(`observing txcount, txs array: ${this.txs.length}`);
          this.rpc_update(false);
        });
    this.rpc.state.observe('blocks')
      .subscribe(
        block => {
          if (block > this.block && this.block !== 0) {
            this.rpc_update(true);
          }
          this.block = block;
        });

    /* check if testnet -> block explorer url */
    this.rpc.state.observe('chain').take(1)
    .subscribe(chain => this.testnet = chain === 'test');
  }

  postConstructor(MAX_TXS_PER_PAGE: number) {
    this.MAX_TXS_PER_PAGE = MAX_TXS_PER_PAGE;
    this.log.d(`postconstructor  called txs array: ${this.txs.length}`);
    // TODO: why is this being called twice after executing a tx?

  }


  changePage(page: number) {
    if (page < 0) {
      return;
    }
    this.loading = true;
    this.currentPage = page;
    this.rpc_update(false);
  }

  deleteTransactions() {
    this.txs = [];
  }

  /** Load transactions over RPC, then parse JSON and call addTransaction to add them to txs array. */
  rpc_update(txCheck: boolean) {

    const options = { 'count' : +this.MAX_TXS_PER_PAGE, 'skip': this.currentPage * this.MAX_TXS_PER_PAGE };
    this.rpc.call('filtertransactions', [options])
    .subscribe(
      (txResponse: Array<Object>) => {
        // The callback will send over an array of JSON transaction objects.
        this.log.d(`rpc_loadTransactions_success, supposedly tx per page: ${this.MAX_TXS_PER_PAGE}`);
        this.log.d(`rpc_loadTransactions_success, real tx per page: ${txResponse.length}`);

        if (txResponse.length !== this.MAX_TXS_PER_PAGE) {
          this.log.er(`rpc_loadTransactions_success, TRANSACTION COUNTS DO NOT MATCH (maybe last page?)`);
        }

        if (txCheck) {
          this.compareTransactionResponse(this.txs, txResponse);
        } else {
          this.deleteTransactions();
          txResponse.forEach((tx) => {
            this.addTransaction(tx);
          });
        }
        this.loading = false;
        this.log.d(`rpc_update, txs array: ${this.txs.length}`);
      });

  }

  // Deserializes JSON objects to Transaction classes.
  addTransaction(json: Object): void {
    this.txs.push(new Transaction(json));
  }

  // Compare old and new transactions to find out updated confirmations
  compareTransactionResponse(oldTxs: any, newTxs: any) {
    newTxs.forEach((newtx) => {
      oldTxs.forEach((oldtx) => {
        if (oldtx.txid === newtx.txid && oldtx.confirmations !== newtx.confirmations) {
          oldtx.confirmations = newtx.confirmations;
        }
      });
    });
  }

}