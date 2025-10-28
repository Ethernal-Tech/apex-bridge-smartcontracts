// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ConstantsLib {
    // Status codes for batch processing
    uint8 internal constant BATCH_DOES_NOT_EXISTS = 0;
    uint8 internal constant BATCH_IN_PROGRESS = 1;
    uint8 internal constant BATCH_EXECUTED = 2;
    uint8 internal constant BATCH_FAILED = 3;
}
