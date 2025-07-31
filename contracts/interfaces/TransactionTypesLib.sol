// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library TransactionTypesLib {
    // Status codes for transaction types
    uint8 internal constant NORMAL = 0;
    uint8 internal constant DEFUND = 1;
    uint8 internal constant REFUND = 2;
    uint8 internal constant STAKE_REGISTRATION_AND_DELEGATION = 3;
    uint8 internal constant STAKE_DELEGATION = 4;
    uint8 internal constant STAKE_DEREGISTRATION = 5;
}
