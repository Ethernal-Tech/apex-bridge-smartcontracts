// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ConstantsLib {
    uint8 internal constant NOT_EXISTS = 0;
    uint8 internal constant IN_PROGRESS = 1;
    uint8 internal constant EXECUTED = 2;
    uint8 internal constant FAILED = 3;

    uint8 constant CHAIN_ID_AS_SOURCE = 1 << 0; // 00000001
    uint8 constant CHAIN_ID_AS_DESTINATION = 1 << 1; // 00000010
    uint8 constant CHAIN_ID_AS_BOTH = CHAIN_ID_AS_SOURCE | CHAIN_ID_AS_DESTINATION; // 00000011
}
