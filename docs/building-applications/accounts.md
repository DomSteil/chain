# Accounts

## Introduction

An account is an object in Chain Core that facilitates the management of asset units on a blockchain by creating, tracking, and spending transaction outputs. Each output of a transaction contains a control program that defines of a set of conditions that must be satisfied in order spend the output. The simplest type of control program - an account control program - defines a set of private keys and a quorum of signatures that must be provided to spend an output.

When you create an account, you provide as set of root keys and a quorum that will be used to generate a new account control program each time you wish to deposit asset units into the account. For more information, see [Control Programs](../building-applications/control-programs#account-control-programs).

The account object does not exist on the blockchain - it is local to Chain Core. Only the control programs created in the account are visible on the blockchain. However, when a new transactions is processed by Chain Core, it is annotated with local account data to enable powerful queries. For more information, see [Global vs. Local Data](../learn-more/global-vs-local-data).

## Overview

This guide will walk you through the basic functions of an account:

* Create account
* List accounts by tags
* Transfer asset units between local accounts (within the same Chain Core)
* Receive asset units from an external party
* Transfer asset units to an external party
* Trade asset units with an external party
* List account transactions
* List account balances

This guide assumes you know the basic functions presented in the [5-Minute Guide](../getting-started/five-minute-guide).

### Source Code
All of the code examples in this guide are extracted from a single, runnable Java file.
<a href="../examples/java/Accounts.java" class="downloadBtn btn success" target="\_blank">View Source Code</a>


## Create account

* An `alias` is an optional, user-supplied, unique identifier that you can use to operate on the account. We will use this later to build transactions.
* The `quorum` is the threshold of keys that must sign a transaction to spend asset units controlled by the account.
* A `tag` is an optional key-value field used for arbitrary storage or queries. We will add several tags.

Create an account for Alice.

$code ../examples/java/Accounts.java create-account-alice

Create an account for Bob.

$code ../examples/java/Accounts.java create-account-bob

## List accounts by tags

To list all savings accounts, we build an accounts query, filtering to the `type` tag.

$code ../examples/java/Accounts.java list-accounts-by-tag

## Transfer asset units between local accounts

To transfer assets between accounts within a Chain Core, we can build a transaction using an `account_id` or `account_alias`. This automatically creates a control program for the recipient account.

We will build a transaction transferring to units of gold from Alice's account to Bob's account.

$code ../examples/java/Accounts.java build-transfer

Once we have built the transaction, we need to sign it with the key used to create Alice's account. Note: We do not need to sign on behalf of Bob's account, because Bob is not spending any assets - only receiving.

$code ../examples/java/Accounts.java sign-transfer

Once we have signed the transaction, we can submit it for inclusion in the blockchain.

$code ../examples/java/Accounts.java submit-transfer

## Receive asset units from an external party

Account IDs and aliases are local Chain Core data. They do not exist in the blockchain. When an external party wishes to transfer assets to your account, you must first create a control program for the account. We will create a control program for Bob's account, which we can then send to the external party.

$code ../examples/java/Accounts.java create-control-program

## Transfer asset units to an external party

If you wish to transfer asset units to an external party, you must first request a control program from them. You can then build, sign, and submit a transaction sending asset units to their control program. We will use the control program we created in Bob's account to demonstrate this external facing functionality.

$code ../examples/java/Accounts.java transfer-to-control-program

## List account transactions

Chain Core keeps a time-ordered list of all transactions in the blockchain. These transactions are locally annotated with account and asset data to enable intelligent queries. Note: local data is not present in the blockchain. For more information, see: [Global vs. Local Data](../learn-more/global-vs-local-data).

To list transactions involving Alice's account, we build a transaction query, filtering to transactions where Alice spent asset units or controlled asset units.

$code ../examples/java/Accounts.java list-account-txs

## List account balances

The balance of an asset in an account is the aggregate sum of all asset units controlled by one of its account control programs (existing in unspent outputs) in the blockchain. A helpful analogy is thinking of a pocketbook that contains one $10 bill and one $5 bill. The "balance" of the pocketbook is $15.

To list the balances of all assets in Alice's account, we build a balance query, filtering to Alice's account alias.

$code ../examples/java/Accounts.java list-account-balances

To list all the unspent outputs that comprise the balance of gold in Alice's account, we build an unspent outputs query, filtering to Alice's account alias and the gold asset alias.

$code ../examples/java/Accounts.java list-account-unspent-outputs
