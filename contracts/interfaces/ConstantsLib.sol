// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ConstantsLib {
    // Status codes for batch processing
    uint8 internal constant NOT_EXIST = 0;
    uint8 internal constant IN_PROGRESS = 1;
    uint8 internal constant EXECUTED = 2;
    uint8 internal constant FAILED = 3;
}
