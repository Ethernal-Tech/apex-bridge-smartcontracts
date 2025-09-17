// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library TransactionTypesLib {
    // Status codes for transaction types
    uint8 internal constant NORMAL = 0;
    uint8 internal constant DEFUND = 1;
    uint8 internal constant REFUND = 2;
    uint8 internal constant STAKE = 3;
    uint8 internal constant REDISTRIBUTION = 4;

    // STAKE sub types
    uint8 internal constant STAKE_REGISTRATION = 0;
    uint8 internal constant STAKE_DELEGATION = 1;
    uint8 internal constant STAKE_DEREGISTRATION = 2;

    // Status codes for bridging types
    uint8 internal constant BRIDGING_NORMAL = 0;
    uint8 internal constant BRIDGING_STAKE = 1;
}
