// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BatchTypesLib {
    // Status codes for batch types
    uint8 internal constant NORMAL = 0;
    uint8 internal constant CONSOLIDATION = 1;
    uint8 internal constant VALIDATORSET = 2;
    uint8 internal constant VALIDATORSET_FINAL = 3;
    uint8 internal constant COLORED_COIN = 4;
}
